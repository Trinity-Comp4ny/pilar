-- Financeiro, fase 2 da SPEC 150: motor único de duplicatas no servidor.
--
-- Antes (diagnóstico 2026-11-07, seção 2) a checagem rodava no navegador e só
-- achava descrição IDÊNTICA + valor ±1% + data ±5 dias. Não olhava fornecedor/
-- cliente nem nota fiscal (o sinal mais forte) e "Aluguel escritório" × "Aluguel do
-- escritório" passava. Agora uma função pontua os candidatos:
--
--   certeza  mesma nota fiscal e mesma contraparte (ou contraparte não informada)
--   alta     mesma contraparte, mesmo valor (centavo) e vencimento a até 3 dias
--   média    descrição parecida (pg_trgm >= 0.6, sem o sufixo "(n/m)"), valor ±1%
--            e vencimento a até 5 dias
--
-- Nunca acusa: parcelas do mesmo grupo entre si, o próprio lançamento (edição),
-- cancelados, excluídos e transferências. SECURITY INVOKER sobre a view
-- `lancamentos`: a RLS restringe à empresa de quem chama.
CREATE OR REPLACE FUNCTION public.rpc_buscar_duplicatas(
  p_tipo text,
  p_valor numeric,
  p_data date,
  p_descricao text,
  p_contraparte_id uuid DEFAULT NULL,
  p_nota_fiscal text DEFAULT NULL,
  p_excluir_id uuid DEFAULT NULL,
  p_grupo_parcela uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  descricao text,
  valor numeric,
  data_vencimento date,
  status text,
  contraparte_nome text,
  nota_fiscal text,
  confianca text,
  motivo text
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text := lower(regexp_replace(COALESCE(p_descricao, ''), '\s*\(\d+/\d+\)\s*$', ''));
  -- O campo já foi um Sim/Não: esses valores antigos não identificam nota nenhuma.
  v_nf text := NULLIF(lower(btrim(COALESCE(p_nota_fiscal, ''))), '');
BEGIN
  IF p_tipo NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'tipo inválido: %', p_tipo;
  END IF;
  IF v_nf IN ('sim', 'não', 'nao', 's', 'n', '-') THEN
    v_nf := NULL;
  END IF;
  IF p_valor IS NULL OR p_data IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH cand AS (
    SELECT
      l.id, l.descricao, l.valor, l.data_vencimento, l.status, l.contraparte_nome, l.nota_fiscal,
      CASE
        WHEN v_nf IS NOT NULL
             AND lower(btrim(COALESCE(l.nota_fiscal, ''))) = v_nf
             AND (p_contraparte_id IS NULL OR l.contraparte_id IS NULL OR l.contraparte_id = p_contraparte_id)
          THEN 3
        WHEN p_contraparte_id IS NOT NULL
             AND l.contraparte_id = p_contraparte_id
             AND abs(l.valor - p_valor) < 0.01
             AND abs(l.data_vencimento - p_data) <= 3
          THEN 2
        WHEN v_desc <> ''
             AND similarity(lower(regexp_replace(l.descricao, '\s*\(\d+/\d+\)\s*$', '')), v_desc) >= 0.6
             AND l.valor BETWEEN p_valor * 0.99 AND p_valor * 1.01
             AND abs(l.data_vencimento - p_data) <= 5
          THEN 1
        ELSE 0
      END AS nivel
    FROM public.lancamentos l
    WHERE l.deleted_at IS NULL
      AND l.tipo = p_tipo
      AND l.status <> 'Cancelado'
      AND (p_excluir_id IS NULL OR l.id <> p_excluir_id)
      AND (p_grupo_parcela IS NULL OR l.grupo_parcela IS DISTINCT FROM p_grupo_parcela)
      -- Pré-filtro barato: NF igual ou na janela de data (o resto é decidido no CASE).
      AND (
        (v_nf IS NOT NULL AND lower(btrim(COALESCE(l.nota_fiscal, ''))) = v_nf)
        OR l.data_vencimento BETWEEN p_data - 5 AND p_data + 5
      )
  )
  SELECT
    c.id, c.descricao::text, c.valor::numeric, c.data_vencimento::date, c.status::text,
    c.contraparte_nome::text, c.nota_fiscal::text,
    CASE c.nivel WHEN 3 THEN 'certeza' WHEN 2 THEN 'alta' ELSE 'media' END,
    CASE c.nivel
      WHEN 3 THEN 'Mesma nota fiscal'
      WHEN 2 THEN 'Mesmo ' || CASE WHEN p_tipo = 'receita' THEN 'cliente' ELSE 'fornecedor' END
                  || ', mesmo valor e vencimento próximo'
      ELSE 'Descrição parecida, mesmo valor e vencimento próximo'
    END
  FROM cand c
  WHERE c.nivel > 0
  ORDER BY c.nivel DESC, abs(c.data_vencimento - p_data), c.id
  LIMIT 5;
END;
$fn$;

REVOKE ALL ON FUNCTION public.rpc_buscar_duplicatas(text, numeric, date, text, uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_buscar_duplicatas(text, numeric, date, text, uuid, text, uuid, uuid) TO authenticated;
