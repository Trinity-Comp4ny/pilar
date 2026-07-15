-- ==============================================================================
-- RPC transacional: salvar disciplinas de uma proposta
-- ==============================================================================
-- Antes desta migration nao havia caminho de escrita para proposta_disciplinas
-- (a tabela nunca era populada). O editor de disciplinas em Propostas passa a
-- persistir as linhas por aqui, de forma atomica: apaga as linhas antigas,
-- insere as novas e recalcula custo_estimado / margem_estimada_pct na proposta.
--
-- SECURITY INVOKER: roda com os privilegios do chamador, entao a RLS ja
-- existente em propostas e proposta_disciplinas (escopo por empresa + role)
-- continua valendo. Nao ha bypass de tenant.

-- Overload seguro: DROP + CREATE explicito (CREATE OR REPLACE falha silenciosamente
-- com overloads).
DROP FUNCTION IF EXISTS public.rpc_salvar_proposta_disciplinas(uuid, jsonb);

CREATE FUNCTION public.rpc_salvar_proposta_disciplinas(
  p_proposta_id uuid,
  p_disciplinas jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_valor_proposto numeric;
  v_custo numeric;
BEGIN
  -- A RLS de SELECT em propostas garante que so enxergamos propostas da
  -- propria empresa; se nao encontrar, aborta.
  SELECT empresa_id, valor_proposto
    INTO v_empresa_id, v_valor_proposto
    FROM propostas
   WHERE id = p_proposta_id
     AND deleted_at IS NULL;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Proposta nao encontrada ou sem acesso';
  END IF;

  -- Gate explicito de permissao. A funcao escreve em duas tabelas governadas
  -- por features distintas (proposta_disciplinas -> projetos:editor,
  -- propostas -> propostas:editor). Sem este guard, um chamador com apenas uma
  -- das features produziria escrita parcial silenciosa (RLS filtra por USING
  -- sem erro no UPDATE). Exige as duas features antes de mutar qualquer coisa.
  IF NOT public.user_has_feature('propostas', 'editor') THEN
    RAISE EXCEPTION 'Sem permissao para editar a proposta';
  END IF;
  IF NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Sem permissao para editar as disciplinas da proposta';
  END IF;

  -- Substitui o conjunto de disciplinas (a RLS de write valida empresa + role).
  DELETE FROM proposta_disciplinas WHERE proposta_id = p_proposta_id;

  INSERT INTO proposta_disciplinas (empresa_id, proposta_id, disciplina, horas_estimadas, custo_hora, valor_venda)
  SELECT v_empresa_id,
         p_proposta_id,
         btrim(d->>'disciplina'),
         COALESCE((d->>'horas_estimadas')::numeric, 0),
         COALESCE((d->>'custo_hora')::numeric, 0),
         COALESCE((d->>'valor_venda')::numeric, 0)
    FROM jsonb_array_elements(COALESCE(p_disciplinas, '[]'::jsonb)) AS d
   WHERE btrim(COALESCE(d->>'disciplina', '')) <> '';

  -- Recalcula custo estimado (soma horas x custo/hora) e margem sobre o valor
  -- proposto atual da proposta. Colunas que ate entao ficavam mortas.
  SELECT COALESCE(SUM(horas_estimadas * custo_hora), 0)
    INTO v_custo
    FROM proposta_disciplinas
   WHERE proposta_id = p_proposta_id;

  UPDATE propostas
     SET custo_estimado = v_custo,
         margem_estimada_pct = CASE
           WHEN COALESCE(v_valor_proposto, 0) > 0
             THEN ROUND(((v_valor_proposto - v_custo) / v_valor_proposto) * 100, 2)
           ELSE NULL
         END
   WHERE id = p_proposta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_salvar_proposta_disciplinas(uuid, jsonb) TO authenticated;
