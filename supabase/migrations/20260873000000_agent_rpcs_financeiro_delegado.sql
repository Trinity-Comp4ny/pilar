-- SPEC 073 / ADR 0034: fase 4. RPCs SECURITY DEFINER do agente de IA que
-- escrevem em financeiro/folha ainda checavam user_has_feature('financeiro',
-- 'editor') direto — igual às policies antes da fase 2, davam passagem pra
-- qualquer membro da empresa desde o ADR 0029. Troca pelos mesmos dois
-- helpers: can_view_financeiro() para financeiro geral, can_view_folha()
-- para fechar folha.
--
-- Corpo de cada função reproduzido integralmente a partir da última
-- definição em produção (20260715000033_agent_rpc_tenancy_hardening.sql
-- para as 6 primeiras; 20260714160000_agent_write_cadastros.sql para as 5
-- últimas) — só a linha do gate muda, todo o resto (tenancy checks,
-- inserts, guards de agent_runs) é idêntico.

-- ----------------------------- aprovar_orcamento_agente -----------------------------
DROP FUNCTION IF EXISTS public.aprovar_orcamento_agente(uuid);
CREATE OR REPLACE FUNCTION public.aprovar_orcamento_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_projeto uuid;
  v_count int;
BEGIN
  -- Gate server-side: materializar orçamento mexe em dinheiro (valor_venda).
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para aprovar orçamento';
  END IF;

  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'Run não encontrado';
  END IF;
  IF v_run.empresa_id != v_empresa THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_run.status != 'pending_review' THEN
    RAISE EXCEPTION 'Run não está aguardando revisão (status atual: %)', v_run.status;
  END IF;
  IF v_run.agent_type != 'orcamento_honorarios' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado nesta aprovação: %', v_run.agent_type;
  END IF;

  v_projeto := v_run.entity_id;
  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Run sem projeto associado — associe um projeto antes de aprovar';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projetos
    WHERE id = v_projeto AND empresa_id = v_empresa AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Projeto não pertence à empresa';
  END IF;

  INSERT INTO public.projeto_orcamento_fases
    (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, margem_alvo_pct, valor_venda, observacao, created_by)
  SELECT
    v_empresa,
    v_projeto,
    f.disciplina,
    f.horas_estimadas,
    f.custo_hora,
    f.margem_alvo_pct,
    round(f.horas_estimadas * f.custo_hora * (1 + f.margem_alvo_pct / 100), 2),
    f.observacao,
    auth.uid()
  FROM jsonb_to_recordset(v_run.result->'fases')
    AS f(disciplina text, horas_estimadas numeric, custo_hora numeric, margem_alvo_pct numeric, observacao text);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.agent_runs
    SET status = 'executed', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'fases_criadas', v_count, 'projeto_id', v_projeto);
END;
$$;
REVOKE ALL ON FUNCTION public.aprovar_orcamento_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_agente(uuid) TO authenticated;

-- ----------------------------- criar_receita_agente -----------------------------
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
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para lançar receita';
  END IF;
  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;

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

  IF NULLIF(v_run.result->>'projeto_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = (v_run.result->>'projeto_id')::uuid AND empresa_id = v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto não pertence à empresa';
  END IF;
  IF NULLIF(v_run.result->>'cliente_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = (v_run.result->>'cliente_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Cliente não pertence à empresa';
  END IF;
  IF NULLIF(v_run.result->>'categoria_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.categorias_financeiras WHERE id = (v_run.result->>'categoria_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Categoria não pertence à empresa';
  END IF;
  IF NULLIF(v_run.result->>'conta_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.contas WHERE id = (v_run.result->>'conta_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Conta não pertence à empresa';
  END IF;

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
REVOKE ALL ON FUNCTION public.criar_receita_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_receita_agente(uuid) TO authenticated;

-- ----------------------------- criar_despesa_agente -----------------------------
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
  v_cartao uuid;
  v_conta uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para lançar despesa';
  END IF;
  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;

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

  v_cartao := NULLIF(v_run.result->>'cartao_id', '')::uuid;
  v_conta := NULLIF(v_run.result->>'conta_id', '')::uuid;
  IF v_cartao IS NOT NULL AND v_conta IS NOT NULL THEN
    RAISE EXCEPTION 'Escolha conta OU cartão, não ambos';
  END IF;

  IF NULLIF(v_run.result->>'projeto_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = (v_run.result->>'projeto_id')::uuid AND empresa_id = v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto não pertence à empresa';
  END IF;
  IF NULLIF(v_run.result->>'fornecedor_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = (v_run.result->>'fornecedor_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Fornecedor não pertence à empresa';
  END IF;
  IF NULLIF(v_run.result->>'categoria_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.categorias_financeiras WHERE id = (v_run.result->>'categoria_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Categoria não pertence à empresa';
  END IF;
  IF v_conta IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.contas WHERE id = v_conta AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Conta não pertence à empresa';
  END IF;
  IF v_cartao IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.cartoes WHERE id = v_cartao AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Cartão não pertence à empresa';
  END IF;

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
      v_conta,
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
    (empresa_id, descricao, valor, status, data_vencimento, data_pagamento, data_competencia,
     forma_pagamento, nota_fiscal, observacao, projeto_id, fornecedor_id, categoria_id, conta_id, cartao_id, is_fatura_payment)
  VALUES (
    v_empresa, v_desc, v_valor,
    COALESCE(NULLIF(v_run.result->>'status', ''), 'Pendente')::status_financeiro,
    NULLIF(v_run.result->>'data_vencimento', '')::date,
    NULLIF(v_run.result->>'data_pagamento', '')::date,
    NULLIF(v_run.result->>'data_competencia', '')::date,
    NULLIF(trim(v_run.result->>'forma_pagamento'), ''),
    NULLIF(trim(v_run.result->>'nota_fiscal'), ''),
    NULLIF(trim(v_run.result->>'observacao'), ''),
    NULLIF(v_run.result->>'projeto_id', '')::uuid,
    NULLIF(v_run.result->>'fornecedor_id', '')::uuid,
    NULLIF(v_run.result->>'categoria_id', '')::uuid,
    v_conta,
    v_cartao,
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
REVOKE ALL ON FUNCTION public.criar_despesa_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_despesa_agente(uuid) TO authenticated;

-- ----------------------------- criar_cartao_agente -----------------------------
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
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar cartão';
  END IF;
  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;

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

  IF NULLIF(v_run.result->>'conta_pagamento_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.contas WHERE id = (v_run.result->>'conta_pagamento_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Conta de pagamento não pertence à empresa';
  END IF;

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
REVOKE ALL ON FUNCTION public.criar_cartao_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_cartao_agente(uuid) TO authenticated;

-- ----------------------------- fechar_folha_agente -----------------------------
-- Pagamento de pessoas: entra no gate de FOLHA (can_view_folha), não financeiro geral.
DROP FUNCTION IF EXISTS public.fechar_folha_agente(uuid);
CREATE OR REPLACE FUNCTION public.fechar_folha_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_mes int;
  v_ano int;
  v_count int;
BEGIN
  IF NOT public.can_view_folha() THEN
    RAISE EXCEPTION 'Sem permissão para fechar folha';
  END IF;
  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN
    RAISE EXCEPTION 'Run não está aguardando revisão (status atual: %)', v_run.status;
  END IF;
  IF v_run.agent_type != 'fechar_folha' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado: %', v_run.agent_type;
  END IF;

  v_mes := NULLIF(v_run.result->>'mes', '')::int;
  v_ano := NULLIF(v_run.result->>'ano', '')::int;
  IF v_mes IS NULL OR v_mes < 1 OR v_mes > 12 OR v_ano IS NULL THEN
    RAISE EXCEPTION 'Mês/ano inválidos';
  END IF;

  IF EXISTS (SELECT 1 FROM public.folha_pagamento WHERE empresa_id = v_empresa AND mes = v_mes AND ano = v_ano) THEN
    RAISE EXCEPTION 'A folha de %/% já foi fechada', v_mes, v_ano;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_run.result->'linhas') AS l(pessoa_id uuid)
    WHERE l.pessoa_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.pessoas p WHERE p.id = l.pessoa_id AND p.empresa_id = v_empresa)
  ) THEN
    RAISE EXCEPTION 'Uma ou mais pessoas da folha não pertencem à empresa';
  END IF;

  INSERT INTO public.folha_pagamento
    (empresa_id, pessoa_id, mes, ano, salario_fixo, total_area_projetada, valor_m2, adicional_variavel, total_receber, status)
  SELECT
    v_empresa, l.pessoa_id, v_mes, v_ano,
    COALESCE(l.salario_fixo, 0), COALESCE(l.total_area_projetada, 0), COALESCE(l.valor_m2, 0),
    COALESCE(l.adicional_variavel, 0), COALESCE(l.total_receber, 0), 'pendente'
  FROM jsonb_to_recordset(v_run.result->'linhas') AS l(
    pessoa_id uuid,
    salario_fixo numeric,
    total_area_projetada numeric,
    valor_m2 numeric,
    adicional_variavel numeric,
    total_receber numeric
  )
  WHERE l.pessoa_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'Nenhuma linha de folha para inserir'; END IF;

  UPDATE public.agent_runs
    SET status = 'executed', entity_type = 'folha', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'linhas', v_count, 'mes', v_mes, 'ano', v_ano);
END;
$$;
REVOKE ALL ON FUNCTION public.fechar_folha_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_folha_agente(uuid) TO authenticated;

-- ----------------------------- executar_acao_agente -----------------------------
-- Dispatcher: 4 dos 5 ramos (marcar_recebido/marcar_pago/quitar_parcela/pagar_fatura)
-- são financeiro geral. converter_lead/converter_proposta não mudam (gates próprios).
DROP FUNCTION IF EXISTS public.executar_acao_agente(uuid);
CREATE OR REPLACE FUNCTION public.executar_acao_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_acao text;
  v_out jsonb := jsonb_build_object('ok', true);
  v_uuid uuid;
  v_n int;
  v_data date;
BEGIN
  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'acao' THEN RAISE EXCEPTION 'Run não é uma ação'; END IF;

  v_acao := v_run.result->>'acao';
  v_data := COALESCE(NULLIF(v_run.result->>'data','')::date, CURRENT_DATE);

  IF v_acao = 'converter_lead' THEN
    IF NOT public.user_has_feature('clientes','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = (v_run.result->>'lead_id')::uuid AND empresa_id = v_empresa AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Lead não pertence à empresa'; END IF;
    v_uuid := public.rpc_converter_lead_cliente((v_run.result->>'lead_id')::uuid);
    v_out := jsonb_build_object('ok', true, 'cliente_id', v_uuid);

  ELSIF v_acao = 'converter_proposta' THEN
    IF NOT public.user_has_feature('projetos','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.propostas WHERE id = (v_run.result->>'proposta_id')::uuid AND empresa_id = v_empresa AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Proposta não pertence à empresa'; END IF;
    v_uuid := public.rpc_converter_proposta_projeto((v_run.result->>'proposta_id')::uuid);
    v_out := jsonb_build_object('ok', true, 'projeto_id', v_uuid);

  ELSIF v_acao = 'marcar_recebido' THEN
    IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    UPDATE public.receitas SET status='Recebido', data_recebimento=v_data, updated_at=now()
      WHERE id=(v_run.result->>'receita_id')::uuid AND empresa_id=v_empresa AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'Receita não encontrada'; END IF;

  ELSIF v_acao = 'marcar_pago' THEN
    IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    UPDATE public.despesas SET status='Pago', data_pagamento=v_data, updated_at=now()
      WHERE id=(v_run.result->>'despesa_id')::uuid AND empresa_id=v_empresa AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;

  ELSIF v_acao = 'quitar_parcela' THEN
    IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.grupos_parcela WHERE id = (v_run.result->>'grupo_id')::uuid AND empresa_id = v_empresa) THEN
      RAISE EXCEPTION 'Grupo de parcelas não pertence à empresa'; END IF;
    v_n := public.rpc_grupo_parcela_quitar_antecipado(
      (v_run.result->>'grupo_id')::uuid, v_data,
      NULLIF(v_run.result->>'quantidade','')::int,
      COALESCE(NULLIF(v_run.result->>'desconto','')::numeric, 0));
    v_out := jsonb_build_object('ok', true, 'parcelas_quitadas', v_n);

  ELSIF v_acao = 'pagar_fatura' THEN
    IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.faturas WHERE id = (v_run.result->>'fatura_id')::uuid AND empresa_id = v_empresa) THEN
      RAISE EXCEPTION 'Fatura não pertence à empresa'; END IF;
    IF NULLIF(v_run.result->>'conta_id','') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.contas WHERE id = (v_run.result->>'conta_id')::uuid AND empresa_id = v_empresa) THEN
      RAISE EXCEPTION 'Conta não pertence à empresa'; END IF;
    PERFORM public.pagar_fatura(
      (v_run.result->>'fatura_id')::uuid, (v_run.result->>'conta_id')::uuid,
      NULLIF(v_run.result->>'valor','')::numeric, v_data, p_run_id::text);
    v_out := jsonb_build_object('ok', true, 'fatura_id', v_run.result->>'fatura_id');

  ELSE
    RAISE EXCEPTION 'Ação desconhecida: %', v_acao;
  END IF;

  UPDATE public.agent_runs
    SET status='executed', entity_type=v_acao, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=p_run_id;

  RETURN v_out;
END; $$;
REVOKE ALL ON FUNCTION public.executar_acao_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.executar_acao_agente(uuid) TO authenticated;

-- ----------------------------- criar_fornecedor_agente -----------------------------
DROP FUNCTION IF EXISTS public.criar_fornecedor_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_fornecedor_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text;
BEGIN
  IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão para criar fornecedor'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_fornecedor' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Fornecedor sem nome'; END IF;
  INSERT INTO public.fornecedores (empresa_id, nome, cnpj, contato, email, telefone)
  VALUES (v_empresa, v_nome, NULLIF(trim(v_run.result->>'cnpj'),''), NULLIF(trim(v_run.result->>'contato'),''),
          NULLIF(trim(v_run.result->>'email'),''), NULLIF(trim(v_run.result->>'telefone'),''))
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='fornecedor', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'fornecedor_id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.criar_fornecedor_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_fornecedor_agente(uuid) TO authenticated;

-- ----------------------------- criar_categoria_agente -----------------------------
DROP FUNCTION IF EXISTS public.criar_categoria_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_categoria_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text; v_tipo text;
BEGIN
  IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão para criar categoria'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_categoria' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Categoria sem nome'; END IF;
  v_tipo := NULLIF(trim(v_run.result->>'tipo'),'');
  IF v_tipo NOT IN ('Receita','Despesa') THEN RAISE EXCEPTION 'Tipo da categoria deve ser Receita ou Despesa'; END IF;
  INSERT INTO public.categorias_financeiras (empresa_id, nome, tipo)
  VALUES (v_empresa, v_nome, v_tipo::tipo_categoria)
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='categoria', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'categoria_id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.criar_categoria_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_categoria_agente(uuid) TO authenticated;

-- ----------------------------- criar_conta_agente -----------------------------
DROP FUNCTION IF EXISTS public.criar_conta_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_conta_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text; v_banco text;
BEGIN
  IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão para criar conta'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_conta' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Conta sem nome'; END IF;
  v_banco := NULLIF(trim(v_run.result->>'banco'),''); IF v_banco IS NULL THEN RAISE EXCEPTION 'Conta sem banco'; END IF;
  INSERT INTO public.contas (empresa_id, nome, banco, saldo_inicial, chave_pix, tipo_chave_pix)
  VALUES (v_empresa, v_nome, v_banco, COALESCE(NULLIF(v_run.result->>'saldo_inicial','')::numeric,0),
          NULLIF(trim(v_run.result->>'chave_pix'),''), NULLIF(trim(v_run.result->>'tipo_chave_pix'),''))
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='conta', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'conta_id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.criar_conta_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_conta_agente(uuid) TO authenticated;

-- ----------------------------- criar_centro_custo_agente -----------------------------
DROP FUNCTION IF EXISTS public.criar_centro_custo_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_centro_custo_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text;
BEGIN
  IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão para criar centro de custo'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_centro_custo' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Centro de custo sem nome'; END IF;
  INSERT INTO public.centros_custo (empresa_id, nome, codigo, descricao, ativo, created_by, updated_by)
  VALUES (v_empresa, v_nome, NULLIF(trim(v_run.result->>'codigo'),''), NULLIF(trim(v_run.result->>'descricao'),''), true, auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='centro_custo', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'centro_custo_id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.criar_centro_custo_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_centro_custo_agente(uuid) TO authenticated;

-- ----------------------------- criar_marco_agente -----------------------------
DROP FUNCTION IF EXISTS public.criar_marco_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_marco_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text; v_valor numeric; v_projeto uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN RAISE EXCEPTION 'Sem permissão para criar marco'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_marco' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_projeto := NULLIF(v_run.result->>'projeto_id','')::uuid;
  IF v_projeto IS NULL THEN RAISE EXCEPTION 'Marco precisa de um projeto'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE id=v_projeto AND empresa_id=v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto inválido'; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Marco sem nome'; END IF;
  v_valor := NULLIF(v_run.result->>'valor','')::numeric; IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Marco precisa de valor'; END IF;
  INSERT INTO public.marcos_faturamento (empresa_id, projeto_id, nome, valor, disciplina, percentual, data_prevista, status)
  VALUES (v_empresa, v_projeto, v_nome, v_valor, NULLIF(trim(v_run.result->>'disciplina'),''),
          NULLIF(v_run.result->>'percentual','')::numeric, NULLIF(v_run.result->>'data_prevista','')::date, 'pendente')
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='marco', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'marco_id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.criar_marco_agente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_marco_agente(uuid) TO authenticated;
