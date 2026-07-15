-- Hardening cross-tenant dos RPCs de escrita do Agente (SECURITY DEFINER).
--
-- Contexto: os RPCs criar_*_agente / executar_acao_agente rodam SECURITY DEFINER e leem FKs
-- diretamente de agent_runs.result, que o cliente pode reescrever antes de aprovar (a validação
-- Zod da edge é bypassável). O RPC é a ÚNICA barreira. Sem checar tenancy, um usuário da empresa A
-- podia injetar no result um projeto_id/cliente_id/conta_id/pessoa_id/etc. da empresa B e o INSERT
-- gravaria linhas cruzando tenants (empresa_id = A referenciando FK de B), ou disparar ações
-- (converter proposta, pagar fatura) sobre entidades de outra empresa.
--
-- Padrão de correção (igual criar_marco/criar_disciplina/criar_aditivo): antes de qualquer INSERT
-- ou delegação, validar EXISTS(... WHERE id = <fk> AND empresa_id = v_empresa) para CADA FK vinda
-- do result e RAISE se não pertencer. Aqui só ADICIONAMOS as checagens: assinatura, corpo, gates de
-- role/feature e GRANTs permanecem idênticos aos das migrations já aplicadas.
--
-- Também endurece as policies de agent_runs:
--  • INSERT: era WITH CHECK (true) → qualquer authenticated injetava run com empresa_id arbitrário.
--  • UPDATE + trigger: fixa empresa_id/created_by como imutáveis e impede reabrir runs terminais.

-- ===========================================================================
-- 1. RPCs de escrita: validação de tenancy de cada FK vinda do result
-- ===========================================================================

-- ----------------------------- criar_lead_agente -----------------------------
-- FK: responsavel_id → profiles (usuário membro da empresa).
DROP FUNCTION IF EXISTS public.criar_lead_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_lead_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_lead_id uuid;
  v_nome text;
BEGIN
  -- Gate server-side (fix A1): sem esta checagem, um viewer poderia gravar via RPC.
  IF NOT public.user_has_feature('leads', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para criar lead';
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
  IF v_run.agent_type != 'criar_lead' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado nesta aprovação: %', v_run.agent_type;
  END IF;

  v_nome := NULLIF(trim(v_run.result->>'nome'), '');
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Lead sem nome — preencha o nome antes de criar';
  END IF;

  -- Tenancy: responsável precisa ser membro da própria empresa.
  IF NULLIF(v_run.result->>'responsavel_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = (v_run.result->>'responsavel_id')::uuid AND empresa_id = v_empresa
     ) THEN
    RAISE EXCEPTION 'Responsável não pertence à empresa';
  END IF;

  INSERT INTO public.leads
    (empresa_id, nome, sobrenome, email, contato, origem, valor_estimado, empresa_lead, cnpj, notas,
     responsavel_id, previsao_fechamento, status, created_by)
  VALUES (
    v_empresa,
    v_nome,
    NULLIF(trim(v_run.result->>'sobrenome'), ''),
    NULLIF(trim(v_run.result->>'email'), ''),
    NULLIF(trim(v_run.result->>'contato'), ''),
    NULLIF(trim(v_run.result->>'origem'), ''),
    NULLIF(v_run.result->>'valor_estimado', '')::numeric,
    NULLIF(trim(v_run.result->>'empresa_lead'), ''),
    NULLIF(trim(v_run.result->>'cnpj'), ''),
    NULLIF(trim(v_run.result->>'notas'), ''),
    NULLIF(v_run.result->>'responsavel_id', '')::uuid,
    NULLIF(v_run.result->>'previsao_fechamento', '')::date,
    'Novo',
    auth.uid()
  )
  RETURNING id INTO v_lead_id;

  UPDATE public.agent_runs
    SET status = 'executed',
        entity_type = 'lead',
        entity_id = v_lead_id,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.criar_lead_agente(uuid) TO authenticated;

-- ------------------------- aprovar_orcamento_agente -------------------------
-- FK: entity_id é usado como projeto_id sem validação. Um run da empresa A com entity_id
-- apontando pra um projeto da empresa B gravaria fases de orçamento no projeto alheio.
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
  -- Gate server-side (fix A1): materializar orçamento mexe em dinheiro (valor_venda).
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
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
  -- Tenancy: o projeto alvo precisa ser da própria empresa.
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
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_agente(uuid) TO authenticated;

-- ----------------------------- criar_projeto_agente -----------------------------
-- FK: cliente_id → clientes.
DROP FUNCTION IF EXISTS public.criar_projeto_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_projeto_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_projeto_id uuid;
  v_nome text;
  v_codigo text;
  v_seq int;
BEGIN
  -- Gate server-side (fix A1): sem isto, um viewer poderia gravar via RPC.
  IF NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para criar projeto';
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
  IF v_run.agent_type != 'criar_projeto' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado nesta aprovação: %', v_run.agent_type;
  END IF;

  v_nome := NULLIF(trim(v_run.result->>'nome'), '');
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Projeto sem nome — preencha o nome antes de criar';
  END IF;

  -- Tenancy: cliente vinculado precisa ser da própria empresa.
  IF NULLIF(v_run.result->>'cliente_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.clientes
       WHERE id = (v_run.result->>'cliente_id')::uuid AND empresa_id = v_empresa
     ) THEN
    RAISE EXCEPTION 'Cliente não pertence à empresa';
  END IF;

  -- Código: usa o informado; se vazio, gera sequencial PRJ-XXXX por empresa (igual ao converter).
  v_codigo := NULLIF(trim(v_run.result->>'codigo_projeto'), '');
  IF v_codigo IS NULL THEN
    SELECT COALESCE(MAX(
      CASE WHEN codigo_projeto ~ '^PRJ-\d+$' THEN CAST(SUBSTRING(codigo_projeto FROM 5) AS INT) ELSE 0 END
    ), 0) + 1
    INTO v_seq
    FROM public.projetos
    WHERE empresa_id = v_empresa;
    v_codigo := 'PRJ-' || LPAD(v_seq::text, 4, '0');
  END IF;

  INSERT INTO public.projetos
    (empresa_id, cliente_id, codigo_projeto, nome, localizacao, status,
     data_inicio, data_previsao, data_final, valor_contrato, observacao, parcelas, area_m2, prioridade,
     created_by, updated_by)
  VALUES (
    v_empresa,
    NULLIF(v_run.result->>'cliente_id', '')::uuid,
    v_codigo,
    v_nome,
    NULLIF(trim(v_run.result->>'localizacao'), ''),
    'Planejamento',
    NULLIF(v_run.result->>'data_inicio', '')::date,
    NULLIF(v_run.result->>'data_previsao', '')::date,
    NULLIF(v_run.result->>'data_final', '')::date,
    NULLIF(v_run.result->>'valor_contrato', '')::numeric,
    NULLIF(trim(v_run.result->>'observacao'), ''),
    NULLIF(trim(v_run.result->>'parcelas'), ''),
    COALESCE(NULLIF(v_run.result->>'area_m2', '')::numeric, 0),
    COALESCE(NULLIF(trim(v_run.result->>'prioridade'), ''), 'Media'),
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_projeto_id;

  UPDATE public.agent_runs
    SET status = 'executed',
        entity_type = 'projeto',
        entity_id = v_projeto_id,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'projeto_id', v_projeto_id, 'codigo_projeto', v_codigo);
END;
$$;
GRANT EXECUTE ON FUNCTION public.criar_projeto_agente(uuid) TO authenticated;

-- ----------------------------- criar_receita_agente -----------------------------
-- FKs: projeto_id, cliente_id, categoria_id, conta_id (validadas em ambos os ramos: à vista e parcelado).
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

  -- Tenancy: toda FK vinda do result precisa ser da própria empresa.
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
GRANT EXECUTE ON FUNCTION public.criar_receita_agente(uuid) TO authenticated;

-- ----------------------------- criar_despesa_agente -----------------------------
-- FKs: projeto_id, fornecedor_id, categoria_id, conta_id, cartao_id.
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
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
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

  -- Tenancy: toda FK vinda do result precisa ser da própria empresa.
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
GRANT EXECUTE ON FUNCTION public.criar_despesa_agente(uuid) TO authenticated;

-- ----------------------------- criar_cartao_agente -----------------------------
-- FK: conta_pagamento_id → contas.
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

  -- Tenancy: conta de pagamento vinculada precisa ser da própria empresa.
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
GRANT EXECUTE ON FUNCTION public.criar_cartao_agente(uuid) TO authenticated;

-- ----------------------------- fechar_folha_agente -----------------------------
-- FK: pessoa_id de CADA linha → pessoas. Pior caso: fechar folha com pessoa de outro tenant.
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
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
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

  -- Tenancy: TODA pessoa_id das linhas precisa ser da própria empresa (bloqueia folha com pessoa alheia).
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
GRANT EXECUTE ON FUNCTION public.fechar_folha_agente(uuid) TO authenticated;

-- ----------------------------- criar_proposta_agente -----------------------------
-- FKs: cliente_id → clientes, lead_id → leads.
DROP FUNCTION IF EXISTS public.criar_proposta_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_proposta_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_titulo text;
BEGIN
  IF NOT public.user_has_feature('propostas','editor') THEN RAISE EXCEPTION 'Sem permissão para criar proposta'; END IF;
  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_proposta' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_titulo := NULLIF(trim(v_run.result->>'titulo'),''); IF v_titulo IS NULL THEN RAISE EXCEPTION 'Proposta sem título'; END IF;
  -- Tenancy: cliente e lead vinculados precisam ser da própria empresa.
  IF NULLIF(v_run.result->>'cliente_id','') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = (v_run.result->>'cliente_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Cliente não pertence à empresa'; END IF;
  IF NULLIF(v_run.result->>'lead_id','') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.leads WHERE id = (v_run.result->>'lead_id')::uuid AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Lead não pertence à empresa'; END IF;
  INSERT INTO public.propostas (empresa_id, titulo, cliente_id, lead_id, valor_proposto, area_m2, localizacao,
     prazo_estimado_dias, validade, observacao, status)
  VALUES (v_empresa, v_titulo,
     NULLIF(v_run.result->>'cliente_id','')::uuid, NULLIF(v_run.result->>'lead_id','')::uuid,
     NULLIF(v_run.result->>'valor_proposto','')::numeric, NULLIF(v_run.result->>'area_m2','')::numeric,
     NULLIF(trim(v_run.result->>'localizacao'),''), NULLIF(v_run.result->>'prazo_estimado_dias','')::int,
     NULLIF(v_run.result->>'validade','')::date, NULLIF(trim(v_run.result->>'observacao'),''), 'rascunho')
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='proposta', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'proposta_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_proposta_agente(uuid) TO authenticated;

-- ----------------------------- executar_acao_agente -----------------------------
-- Dispatcher de ações sobre entidades existentes. Antes de delegar, valida CADA alvo vindo do
-- result contra a empresa. Defesa em profundidade: rpc_converter_proposta_projeto NÃO checa a
-- empresa da proposta (deriva empresa_id da própria proposta), então sem esta checagem um usuário
-- da empresa A converteria a proposta da empresa B em projeto da empresa B.
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
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    UPDATE public.receitas SET status='Recebido', data_recebimento=v_data, updated_at=now()
      WHERE id=(v_run.result->>'receita_id')::uuid AND empresa_id=v_empresa AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'Receita não encontrada'; END IF;

  ELSIF v_acao = 'marcar_pago' THEN
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    UPDATE public.despesas SET status='Pago', data_pagamento=v_data, updated_at=now()
      WHERE id=(v_run.result->>'despesa_id')::uuid AND empresa_id=v_empresa AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;

  ELSIF v_acao = 'quitar_parcela' THEN
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.grupos_parcela WHERE id = (v_run.result->>'grupo_id')::uuid AND empresa_id = v_empresa) THEN
      RAISE EXCEPTION 'Grupo de parcelas não pertence à empresa'; END IF;
    v_n := public.rpc_grupo_parcela_quitar_antecipado(
      (v_run.result->>'grupo_id')::uuid, v_data,
      NULLIF(v_run.result->>'quantidade','')::int,
      COALESCE(NULLIF(v_run.result->>'desconto','')::numeric, 0));
    v_out := jsonb_build_object('ok', true, 'parcelas_quitadas', v_n);

  ELSIF v_acao = 'pagar_fatura' THEN
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
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
GRANT EXECUTE ON FUNCTION public.executar_acao_agente(uuid) TO authenticated;

-- ===========================================================================
-- 2. Policy de INSERT de agent_runs: fechar o WITH CHECK (true)
-- ===========================================================================
-- A edge ai-chat insere agent_runs via JWT do usuário (role authenticated), então a policy antiga
-- WITH CHECK (true) deixava qualquer authenticated gravar um run com empresa_id de outra empresa.
-- A edge sempre grava empresa_id = empresa do próprio usuário (profiles), então a checagem passa.
DROP POLICY IF EXISTS "agent_runs_service_insert" ON public.agent_runs;
CREATE POLICY "agent_runs_service_insert" ON public.agent_runs
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());

-- ===========================================================================
-- 3. UPDATE de agent_runs: pinar empresa_id/created_by e travar runs terminais
-- ===========================================================================
-- A policy de UPDATE já restringe à própria empresa (USING + WITH CHECK). NÃO adicionamos
-- created_by = auth.uid() porque o cockpit de revisão (useRejeitarRun) permite que um revisor
-- diferente do criador rejeite o draft via UPDATE direto — isso quebraria o fluxo legítimo.
--
-- Em vez disso, um trigger fixa empresa_id e created_by como imutáveis (impede regravar o dono ou
-- migrar o run de tenant) e impede reabrir um run já finalizado (executed/rejected/failed) por
-- update direto do cliente. Contextos elevados (RPCs SECURITY DEFINER, edge via service_role)
-- ficam isentos, então o fluxo de aprovação/rejeição/convite continua funcionando.
-- SECURITY INVOKER (padrão) de propósito: dentro de uma função SECURITY DEFINER, current_user seria
-- o dono (postgres) e a checagem abaixo nunca dispararia. Como INVOKER, current_user reflete o papel
-- real que executa o UPDATE — 'authenticated' no cliente direto, 'postgres' via RPC, 'service_role' na edge.
CREATE OR REPLACE FUNCTION public.tg_agent_runs_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'empresa_id de um run é imutável';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by de um run é imutável';
  END IF;
  -- Só clientes diretos (authenticated/anon) são barrados; RPCs e service_role passam.
  IF current_user IN ('authenticated', 'anon')
     AND OLD.status IN ('executed', 'rejected', 'failed')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Run já finalizado não pode mudar de status';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_agent_runs_guard ON public.agent_runs;
CREATE TRIGGER trg_agent_runs_guard
  BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_agent_runs_guard();
