-- Fecha o vetor authenticated-cross-tenant em 3 RPCs SECURITY DEFINER que a
-- 20260810120000_harden_rpc_grants_anon.sql deixou explicitamente como FOLLOW-UP.
--
-- CONTEXTO: aquela migration só revogou EXECUTE de anon/PUBLIC (fechava o vetor pior,
-- qualquer pessoa na internet). O corpo das 3 funções continuava sem comparar a
-- empresa do registro com a empresa de quem chama, então qualquer usuário
-- authenticated de QUALQUER empresa conseguia converter proposta, gerar parcela ou
-- gerar alerta em cima de dado de outro tenant. Reconfirmado por um estudo externo de
-- arquitetura em 2026-08-17, 7 dias depois do fix parcial, ainda sem correção.
--
-- Nenhuma das duas funções abaixo é chamada de contexto anônimo nem de service_role:
-- src/hooks/usePropostas.ts e src/pages/projetos/components/BillingMilestonesTab.tsx
-- rodam sempre com o client autenticado do usuário logado.
--
-- rpc_gerar_alertas(uuid): overload órfão, sem nenhum caller no repo (grep em src/ e
-- supabase/functions/). rpc_daily_maintenance chama a versão sem argumento, que já
-- deriva a empresa via get_user_empresa_id() desde 013_rpcs_empresa_check.sql. Em vez
-- de adicionar tenant check num overload morto, dropa (ver
-- feedback_supabase_function_overload: CREATE OR REPLACE não mata overload de
-- assinatura diferente, só DROP explícito mata).

-- =============================================
-- 1. rpc_converter_proposta_projeto
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_projeto(p_proposta_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta RECORD;
  v_empresa_id UUID;
  v_projeto_id UUID;
  v_disc RECORD;
  v_disciplinas_json JSONB := '[]'::JSONB;
  v_codigo TEXT;
  v_seq INT;
  v_caller_empresa_id UUID;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Buscar proposta
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_proposta.projeto_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta já foi convertida em projeto';
  END IF;

  v_empresa_id := v_proposta.empresa_id;

  -- Gerar codigo sequencial único por empresa
  SELECT COALESCE(MAX(
    CASE WHEN codigo_projeto ~ '^PRJ-\d+$'
      THEN CAST(SUBSTRING(codigo_projeto FROM 5) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM projetos
  WHERE empresa_id = v_empresa_id;

  v_codigo := 'PRJ-' || LPAD(v_seq::TEXT, 4, '0');

  -- Montar JSON de disciplinas a partir de proposta_disciplinas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', pd.disciplina,
    'horas_estimadas', pd.horas_estimadas,
    'custo_hora', pd.custo_hora,
    'valor_venda', pd.valor_venda
  )), '[]'::JSONB)
  INTO v_disciplinas_json
  FROM proposta_disciplinas pd
  WHERE pd.proposta_id = p_proposta_id;

  -- Criar projeto
  INSERT INTO projetos (
    empresa_id, codigo_projeto, nome, cliente_id, valor_contrato,
    area_m2, localizacao, status, prioridade, disciplinas,
    data_inicio, data_previsao, observacao
  ) VALUES (
    v_empresa_id,
    v_codigo,
    v_proposta.titulo,
    v_proposta.cliente_id,
    COALESCE(v_proposta.valor_proposto, 0),
    v_proposta.area_m2,
    v_proposta.localizacao,
    'Planejamento',
    'Media',
    v_disciplinas_json,
    CURRENT_DATE,
    CASE WHEN v_proposta.prazo_estimado_dias IS NOT NULL
      THEN CURRENT_DATE + (v_proposta.prazo_estimado_dias || ' days')::INTERVAL
      ELSE NULL
    END,
    v_proposta.observacao
  )
  RETURNING id INTO v_projeto_id;

  -- Criar orcamento por fase/disciplina a partir de proposta_disciplinas
  FOR v_disc IN
    SELECT disciplina, horas_estimadas, custo_hora, valor_venda
    FROM proposta_disciplinas
    WHERE proposta_id = p_proposta_id
  LOOP
    INSERT INTO projeto_orcamento_fases (
      empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda, margem_alvo_pct
    ) VALUES (
      v_empresa_id, v_projeto_id, v_disc.disciplina,
      v_disc.horas_estimadas, v_disc.custo_hora, v_disc.valor_venda,
      CASE WHEN v_disc.custo_hora > 0 AND v_disc.horas_estimadas > 0 AND v_disc.valor_venda > 0
        THEN ROUND(((v_disc.valor_venda - (v_disc.horas_estimadas * v_disc.custo_hora)) / v_disc.valor_venda) * 100, 2)
        ELSE 20.0
      END
    );
  END LOOP;

  -- Atualizar proposta: vincular ao projeto e marcar como aceita
  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita'
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$function$;

-- =============================================
-- 2. rpc_gerar_parcelas_projeto
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_projeto(p_projeto_id uuid, p_num_parcelas integer DEFAULT 1, p_intervalo_dias integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
  v_caller_empresa_id UUID;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Busca dados do projeto
  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || i || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  -- Ajusta última parcela para fechar o valor exato (evita centavos perdidos)
  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$function$;

-- =============================================
-- 3. rpc_gerar_alertas(uuid) — overload órfão e vulnerável, dropar
-- =============================================

DROP FUNCTION IF EXISTS public.rpc_gerar_alertas(uuid);

-- =============================================
-- 4. Grants explícitos (idempotente; CREATE OR REPLACE preserva grant, mas um
--    `db reset` que rode esta migration antes de qualquer harden futuro precisa
--    nascer correto sem depender de ordem).
-- =============================================

REVOKE ALL ON FUNCTION public.rpc_converter_proposta_projeto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_converter_proposta_projeto(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_gerar_parcelas_projeto(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_parcelas_projeto(uuid, integer, integer) TO authenticated, service_role;
