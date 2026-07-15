-- Parcelamento no Agente Financeiro: receita/despesa com parcelas > 1.
--
-- Usa a RPC CANÔNICA public.rpc_grupo_parcela_criar (cria a linha-pai em grupos_parcela
-- + N filhas coerentes, transacional) — NUNCA o loop client-side que gera grupo órfão.
-- À vista (parcelas <= 1) mantém o insert direto de antes.
--
-- Idempotência preservada pelo guard status='pending_review'. Parceladas nascem 'Pendente'
-- (é agendamento; quitação é operação posterior).

-- ---------------------------------------------------------------------------
-- Receita (à vista OU parcelada)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.criar_receita_agente(uuid);

CREATE OR REPLACE FUNCTION public.criar_receita_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_id uuid;
  v_grupo uuid;
  v_desc text;
  v_valor numeric;
  v_parcelas int;
  v_primeira date;
BEGIN
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para lançar receita';
  END IF;
  v_empresa := public.get_user_empresa_id();

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN
    RAISE EXCEPTION 'Run não está aguardando revisão (status atual: %)', v_run.status;
  END IF;
  IF v_run.agent_type != 'criar_receita' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado: %', v_run.agent_type;
  END IF;

  v_desc := NULLIF(trim(v_run.result->>'descricao'), '');
  IF v_desc IS NULL THEN RAISE EXCEPTION 'Receita sem descrição'; END IF;
  v_valor := NULLIF(v_run.result->>'valor', '')::numeric;
  IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Receita precisa de um valor maior que zero'; END IF;

  v_parcelas := COALESCE(NULLIF(v_run.result->>'parcelas', '')::int, 1);

  IF v_parcelas > 1 THEN
    v_primeira := NULLIF(v_run.result->>'data_vencimento', '')::date;
    IF v_primeira IS NULL THEN RAISE EXCEPTION 'Informe a data de vencimento da 1ª parcela'; END IF;
    v_grupo := public.rpc_grupo_parcela_criar(
      'receita', v_desc, v_valor, v_parcelas, v_primeira, 'mensal',
      NULLIF(v_run.result->>'cliente_id', '')::uuid,
      NULLIF(v_run.result->>'projeto_id', '')::uuid,
      NULLIF(v_run.result->>'categoria_id', '')::uuid,
      NULL,
      NULLIF(v_run.result->>'conta_id', '')::uuid,
      NULL,
      NULLIF(trim(v_run.result->>'forma_pagamento'), ''),
      NULLIF(trim(v_run.result->>'observacao'), ''),
      NULL
    );
    UPDATE public.agent_runs
      SET status = 'executed', entity_type = 'grupo_receita', entity_id = v_grupo,
          reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = p_run_id;
    RETURN jsonb_build_object('ok', true, 'grupo_id', v_grupo, 'parcelado', true);
  END IF;

  INSERT INTO public.receitas
    (empresa_id, descricao, valor, status, data_vencimento, data_recebimento,
     forma_pagamento, nota_fiscal, observacao, projeto_id, cliente_id, categoria_id, conta_id)
  VALUES (
    v_empresa, v_desc, v_valor,
    COALESCE(NULLIF(v_run.result->>'status', ''), 'Pendente')::status_financeiro,
    NULLIF(v_run.result->>'data_vencimento', '')::date,
    NULLIF(v_run.result->>'data_recebimento', '')::date,
    NULLIF(trim(v_run.result->>'forma_pagamento'), ''),
    NULLIF(trim(v_run.result->>'nota_fiscal'), ''),
    NULLIF(trim(v_run.result->>'observacao'), ''),
    NULLIF(v_run.result->>'projeto_id', '')::uuid,
    NULLIF(v_run.result->>'cliente_id', '')::uuid,
    NULLIF(v_run.result->>'categoria_id', '')::uuid,
    NULLIF(v_run.result->>'conta_id', '')::uuid
  )
  RETURNING id INTO v_id;

  UPDATE public.agent_runs
    SET status = 'executed', entity_type = 'receita', entity_id = v_id,
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'receita_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_receita_agente(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Despesa (à vista OU parcelada)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.criar_despesa_agente(uuid);

CREATE OR REPLACE FUNCTION public.criar_despesa_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_id uuid;
  v_grupo uuid;
  v_desc text;
  v_valor numeric;
  v_parcelas int;
  v_primeira date;
BEGIN
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para lançar despesa';
  END IF;
  v_empresa := public.get_user_empresa_id();

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN
    RAISE EXCEPTION 'Run não está aguardando revisão (status atual: %)', v_run.status;
  END IF;
  IF v_run.agent_type != 'criar_despesa' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado: %', v_run.agent_type;
  END IF;

  v_desc := NULLIF(trim(v_run.result->>'descricao'), '');
  IF v_desc IS NULL THEN RAISE EXCEPTION 'Despesa sem descrição'; END IF;
  v_valor := NULLIF(v_run.result->>'valor', '')::numeric;
  IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Despesa precisa de um valor maior que zero'; END IF;

  v_parcelas := COALESCE(NULLIF(v_run.result->>'parcelas', '')::int, 1);

  IF v_parcelas > 1 THEN
    v_primeira := NULLIF(v_run.result->>'data_vencimento', '')::date;
    IF v_primeira IS NULL THEN RAISE EXCEPTION 'Informe a data de vencimento da 1ª parcela'; END IF;
    v_grupo := public.rpc_grupo_parcela_criar(
      'despesa', v_desc, v_valor, v_parcelas, v_primeira, 'mensal',
      NULLIF(v_run.result->>'fornecedor_id', '')::uuid,
      NULLIF(v_run.result->>'projeto_id', '')::uuid,
      NULLIF(v_run.result->>'categoria_id', '')::uuid,
      NULL,
      NULLIF(v_run.result->>'conta_id', '')::uuid,
      NULL,
      NULLIF(trim(v_run.result->>'forma_pagamento'), ''),
      NULLIF(trim(v_run.result->>'observacao'), ''),
      NULL
    );
    UPDATE public.agent_runs
      SET status = 'executed', entity_type = 'grupo_despesa', entity_id = v_grupo,
          reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = p_run_id;
    RETURN jsonb_build_object('ok', true, 'grupo_id', v_grupo, 'parcelado', true);
  END IF;

  INSERT INTO public.despesas
    (empresa_id, descricao, valor, status, data_vencimento, data_pagamento,
     forma_pagamento, nota_fiscal, observacao, projeto_id, fornecedor_id, categoria_id, conta_id, is_fatura_payment)
  VALUES (
    v_empresa, v_desc, v_valor,
    COALESCE(NULLIF(v_run.result->>'status', ''), 'Pendente')::status_financeiro,
    NULLIF(v_run.result->>'data_vencimento', '')::date,
    NULLIF(v_run.result->>'data_pagamento', '')::date,
    NULLIF(trim(v_run.result->>'forma_pagamento'), ''),
    NULLIF(trim(v_run.result->>'nota_fiscal'), ''),
    NULLIF(trim(v_run.result->>'observacao'), ''),
    NULLIF(v_run.result->>'projeto_id', '')::uuid,
    NULLIF(v_run.result->>'fornecedor_id', '')::uuid,
    NULLIF(v_run.result->>'categoria_id', '')::uuid,
    NULLIF(v_run.result->>'conta_id', '')::uuid,
    false
  )
  RETURNING id INTO v_id;

  UPDATE public.agent_runs
    SET status = 'executed', entity_type = 'despesa', entity_id = v_id,
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'despesa_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_despesa_agente(uuid) TO authenticated;
