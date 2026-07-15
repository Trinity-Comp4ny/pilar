-- Modo de ação do Agente Financeiro (fase 1 — inserts atômicos "à vista").
--
-- Cria receita, despesa e cartão a partir de um agent_run, no mesmo padrão de
-- criar_lead_agente / criar_projeto_agente. Guardrails: gate server-side
-- user_has_feature('financeiro','editor') (SECURITY DEFINER bypassa RLS), guard de status.
--
-- ESCOPO FASE 1: 1 lançamento à vista. NÃO trata parcelamento (grupo_parcela) nem
-- despesa de cartão (cartao_id / triggers de fatura) — deixado para tratamento dedicado.

-- ---------------------------------------------------------------------------
-- Receita
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
  v_desc text;
  v_valor numeric;
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
-- Despesa
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
  v_desc text;
  v_valor numeric;
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

-- ---------------------------------------------------------------------------
-- Cartão de crédito (cadastro)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.criar_cartao_agente(uuid);

CREATE OR REPLACE FUNCTION public.criar_cartao_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_id uuid;
  v_nome text;
  v_limite numeric;
  v_fech int;
  v_venc int;
BEGIN
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar cartão';
  END IF;
  v_empresa := public.get_user_empresa_id();

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN
    RAISE EXCEPTION 'Run não está aguardando revisão (status atual: %)', v_run.status;
  END IF;
  IF v_run.agent_type != 'criar_cartao' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado: %', v_run.agent_type;
  END IF;

  v_nome := NULLIF(trim(v_run.result->>'nome'), '');
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Cartão sem nome'; END IF;
  v_limite := COALESCE(NULLIF(v_run.result->>'limite', '')::numeric, 0);
  v_fech := NULLIF(v_run.result->>'dia_fechamento', '')::int;
  v_venc := NULLIF(v_run.result->>'dia_vencimento', '')::int;
  IF v_fech IS NOT NULL AND (v_fech < 1 OR v_fech > 31) THEN RAISE EXCEPTION 'Dia de fechamento inválido'; END IF;
  IF v_venc IS NOT NULL AND (v_venc < 1 OR v_venc > 31) THEN RAISE EXCEPTION 'Dia de vencimento inválido'; END IF;

  INSERT INTO public.cartoes (empresa_id, nome, limite, tipo, dia_fechamento, dia_vencimento, conta_pagamento_id)
  VALUES (
    v_empresa, v_nome, v_limite,
    COALESCE(NULLIF(trim(v_run.result->>'tipo'), ''), 'credito'),
    v_fech, v_venc,
    NULLIF(v_run.result->>'conta_pagamento_id', '')::uuid
  )
  RETURNING id INTO v_id;

  UPDATE public.agent_runs
    SET status = 'executed', entity_type = 'cartao', entity_id = v_id,
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'cartao_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_cartao_agente(uuid) TO authenticated;
