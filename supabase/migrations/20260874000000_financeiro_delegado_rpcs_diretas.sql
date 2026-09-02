-- SPEC 073 / ADR 0034: fase 5, achado do rls-auditor no diff das migrations
-- 20260867-70. `pagar_fatura`, as RPCs de `rpc_grupo_parcela_*` e
-- `update_projeto_completo` são SECURITY DEFINER com GRANT EXECUTE direto
-- pra `authenticated`, checavam só `empresa_id`, nunca passaram pelo gate de
-- financeiro. Bypassam RLS por serem definer, não por policy fraca — o grep
-- de fechamento da SPEC 073 (`user_has_feature\('financeiro'`) não pega essa
-- classe porque elas nunca chamaram esse helper. Não é regressão desta
-- feature, mas é o mesmo furo de negócio (usuário sem financeiro_delegado
-- lançando/pagando/renegociando via RPC direto) por porta diferente.
--
-- pagar_fatura e as 4 rpc_grupo_parcela_*: ações puramente financeiras, sem
-- uso legítimo fora de financeiro. Gate cheio: can_view_financeiro() logo no
-- topo, igual às RPCs do agente (migration 20260870000000).
--
-- update_projeto_completo é diferente: edita o projeto inteiro (nome, status,
-- datas, disciplinas), não só dinheiro. Gatear a função inteira bloquearia
-- coordenador/user editando campo não-financeiro do próprio projeto — dano
-- colateral fora do escopo do pedido do cliente. Gate cirúrgico: só quando
-- p_valor_contrato REALMENTE muda em relação ao valor atual do projeto.

-- ----------------------------- pagar_fatura -----------------------------
CREATE OR REPLACE FUNCTION public.pagar_fatura(
  p_fatura_id uuid,
  p_conta_id uuid,
  p_valor_pago numeric DEFAULT NULL::numeric,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura RECORD;
  v_valor_a_pagar numeric(12,2);
  v_empresa_id uuid;
  v_existing_fatura_id uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para pagar fatura';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  -- 0. Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_fatura_id
    FROM public.faturas
    WHERE empresa_id = v_empresa_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_fatura_id IS NOT NULL THEN
      IF v_existing_fatura_id <> p_fatura_id THEN
        RAISE EXCEPTION 'Idempotency key reutilizada para outra fatura';
      END IF;
      RETURN;
    END IF;
  END IF;

  -- 1. Lock e buscar fatura
  SELECT f.*, cc.nome as cartao_nome
  INTO v_fatura
  FROM public.faturas f
  JOIN public.cartoes cc ON f.cartao_id = cc.id
  WHERE f.id = p_fatura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;

  IF v_fatura IS NULL THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;

  IF v_fatura.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_fatura.status = 'Paga' THEN
    RAISE EXCEPTION 'Fatura já está paga';
  END IF;

  v_valor_a_pagar := COALESCE(p_valor_pago, v_fatura.valor_total - v_fatura.valor_pago);

  IF v_valor_a_pagar <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  IF v_valor_a_pagar > (v_fatura.valor_total - v_fatura.valor_pago) THEN
    RAISE EXCEPTION 'Valor excede o saldo devedor da fatura (restante: %)',
      (v_fatura.valor_total - v_fatura.valor_pago);
  END IF;

  -- 2. Atualizar fatura
  UPDATE public.faturas SET
    valor_pago = valor_pago + v_valor_a_pagar,
    conta_pagamento_id = p_conta_id,
    data_pagamento = p_data_pagamento,
    status = CASE
      WHEN (valor_pago + v_valor_a_pagar) >= valor_total THEN 'Paga'
      ELSE 'Parcial'
    END,
    idempotency_key = COALESCE(idempotency_key, p_idempotency_key)
  WHERE id = p_fatura_id;

  -- 3. Se totalmente paga, marcar despesas do cartão como Pago
  IF (v_fatura.valor_pago + v_valor_a_pagar) >= v_fatura.valor_total THEN
    UPDATE public.despesas SET
      status = 'Pago',
      data_pagamento = p_data_pagamento
    WHERE fatura_id = p_fatura_id
      AND cartao_id IS NOT NULL
      AND deleted_at IS NULL
      AND status = 'Pendente';
  END IF;

  -- 4. Criar débito na conta bancária (marcado como pagamento de fatura)
  INSERT INTO public.despesas (
    empresa_id, descricao, valor, data_vencimento, data_pagamento,
    status, conta_id, cartao_id, fatura_id, observacao, is_fatura_payment
  ) VALUES (
    v_fatura.empresa_id,
    'Pgto Fatura ' || v_fatura.cartao_nome || ' ' ||
      LPAD(v_fatura.mes_referencia::TEXT, 2, '0') || '/' || v_fatura.ano_referencia,
    v_valor_a_pagar,
    v_fatura.data_vencimento,
    p_data_pagamento,
    'Pago',
    p_conta_id,
    NULL,
    p_fatura_id,
    'Pagamento de fatura de cartão de crédito',
    true
  );
END;
$function$;

-- ----------------------------- rpc_grupo_parcela_criar -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_criar(
  p_tipo_lancamento text,
  p_descricao text,
  p_total numeric,
  p_num_parcelas integer,
  p_primeira_data date,
  p_periodicidade text DEFAULT 'mensal',
  p_contraparte_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_categoria_id uuid DEFAULT NULL,
  p_centro_custo_id uuid DEFAULT NULL,
  p_conta_id uuid DEFAULT NULL,
  p_cartao_id uuid DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_tags text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_grupo_id uuid;
  v_valor_parcela numeric(12,2);
  v_diferenca numeric(12,2);
  v_data_venc date;
  v_interval interval;
  i integer;
  v_status_inicial text;
  v_contraparte_tipo text;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para lançar parcelado';
  END IF;

  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF p_tipo_lancamento NOT IN ('receita','despesa') THEN
    RAISE EXCEPTION 'tipo_lancamento inválido: %', p_tipo_lancamento;
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 360 THEN
    RAISE EXCEPTION 'num_parcelas deve ser 1-360';
  END IF;

  IF p_total IS NULL OR p_total <= 0 THEN
    RAISE EXCEPTION 'total deve ser positivo';
  END IF;

  v_interval := CASE p_periodicidade
    WHEN 'mensal' THEN INTERVAL '1 month'
    WHEN 'bimestral' THEN INTERVAL '2 months'
    WHEN 'trimestral' THEN INTERVAL '3 months'
    WHEN 'semestral' THEN INTERVAL '6 months'
    WHEN 'anual' THEN INTERVAL '1 year'
    ELSE INTERVAL '1 month'
  END;

  v_contraparte_tipo := CASE p_tipo_lancamento
    WHEN 'receita' THEN 'cliente'
    ELSE 'fornecedor'
  END;

  v_status_inicial := CASE p_tipo_lancamento
    WHEN 'receita' THEN 'Pendente'
    ELSE 'Pendente'
  END;

  v_valor_parcela := ROUND(p_total / p_num_parcelas, 2);
  v_diferenca := p_total - (v_valor_parcela * p_num_parcelas);

  INSERT INTO grupos_parcela (
    empresa_id, tipo_lancamento, tipo_grupo, descricao,
    total_original, num_parcelas, periodicidade,
    contraparte_id, contraparte_tipo, projeto_id, categoria_id,
    centro_custo_id, observacao, created_by, updated_by
  ) VALUES (
    v_empresa_id, p_tipo_lancamento, 'finito', p_descricao,
    p_total, p_num_parcelas, p_periodicidade,
    p_contraparte_id, v_contraparte_tipo, p_projeto_id, p_categoria_id,
    p_centro_custo_id, p_observacao, auth.uid(), auth.uid()
  ) RETURNING id INTO v_grupo_id;

  FOR i IN 1..p_num_parcelas LOOP
    v_data_venc := (p_primeira_data + ((i - 1) * v_interval))::date;

    IF p_tipo_lancamento = 'receita' THEN
      INSERT INTO receitas (
        empresa_id, descricao, valor, data_vencimento, data_competencia,
        status, projeto_id, cliente_id, categoria_id, conta_id,
        centro_custo_id, tags, forma_pagamento, observacao,
        grupo_parcela, parcela_numero, parcela_total,
        created_by, updated_by
      ) VALUES (
        v_empresa_id, p_descricao,
        CASE WHEN i = p_num_parcelas THEN v_valor_parcela + v_diferenca ELSE v_valor_parcela END,
        v_data_venc, v_data_venc,
        v_status_inicial::status_financeiro, p_projeto_id, p_contraparte_id,
        p_categoria_id, p_conta_id, p_centro_custo_id, p_tags,
        p_forma_pagamento, p_observacao,
        v_grupo_id, i, p_num_parcelas,
        auth.uid(), auth.uid()
      );
    ELSE
      INSERT INTO despesas (
        empresa_id, descricao, valor, data_vencimento, data_competencia,
        status, projeto_id, fornecedor_id, categoria_id, conta_id,
        cartao_id, centro_custo_id, tags, forma_pagamento, observacao,
        grupo_parcela, parcela_numero, parcela_total,
        created_by, updated_by
      ) VALUES (
        v_empresa_id, p_descricao,
        CASE WHEN i = p_num_parcelas THEN v_valor_parcela + v_diferenca ELSE v_valor_parcela END,
        v_data_venc, v_data_venc,
        v_status_inicial::status_financeiro, p_projeto_id, p_contraparte_id,
        p_categoria_id, p_conta_id, p_cartao_id, p_centro_custo_id, p_tags,
        p_forma_pagamento, p_observacao,
        v_grupo_id, i, p_num_parcelas,
        auth.uid(), auth.uid()
      );
    END IF;
  END LOOP;

  RETURN v_grupo_id;
END;
$$;

-- ----------------------------- rpc_grupo_parcela_editar_em_aberto -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_editar_em_aberto(
  p_grupo_id uuid,
  p_novo_valor_parcela numeric DEFAULT NULL,
  p_nova_categoria_id uuid DEFAULT NULL,
  p_novo_centro_custo_id uuid DEFAULT NULL,
  p_nova_conta_id uuid DEFAULT NULL,
  p_nova_observacao text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_tipo text;
  v_afetadas integer := 0;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para editar parcelas';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado ou acesso negado';
  END IF;

  IF v_tipo = 'receita' THEN
    UPDATE receitas SET
      valor = COALESCE(p_novo_valor_parcela, valor),
      categoria_id = COALESCE(p_nova_categoria_id, categoria_id),
      centro_custo_id = COALESCE(p_novo_centro_custo_id, centro_custo_id),
      conta_id = COALESCE(p_nova_conta_id, conta_id),
      observacao = COALESCE(p_nova_observacao, observacao),
      updated_by = auth.uid(),
      updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND empresa_id = v_empresa_id
      AND status::text IN ('Pendente', 'Atrasado')
      AND deleted_at IS NULL;
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  ELSE
    UPDATE despesas SET
      valor = COALESCE(p_novo_valor_parcela, valor),
      categoria_id = COALESCE(p_nova_categoria_id, categoria_id),
      centro_custo_id = COALESCE(p_novo_centro_custo_id, centro_custo_id),
      conta_id = COALESCE(p_nova_conta_id, conta_id),
      observacao = COALESCE(p_nova_observacao, observacao),
      updated_by = auth.uid(),
      updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND empresa_id = v_empresa_id
      AND status::text IN ('Pendente', 'Atrasado')
      AND deleted_at IS NULL;
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  END IF;

  UPDATE grupos_parcela
  SET updated_at = now(), updated_by = auth.uid(),
      categoria_id = COALESCE(p_nova_categoria_id, categoria_id),
      centro_custo_id = COALESCE(p_novo_centro_custo_id, centro_custo_id),
      observacao = COALESCE(p_nova_observacao, observacao)
  WHERE id = p_grupo_id;

  RETURN v_afetadas;
END;
$$;

-- ----------------------------- rpc_grupo_parcela_renegociar -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_renegociar(
  p_grupo_id uuid,
  p_novo_total numeric,
  p_novo_num_parcelas integer,
  p_nova_primeira_data date,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_grupo record;
  v_novo_grupo_id uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para renegociar';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  SELECT * INTO v_grupo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_grupo IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado ou acesso negado';
  END IF;

  IF v_grupo.tipo_lancamento = 'receita' THEN
    UPDATE receitas
    SET status = 'Cancelado'::status_financeiro,
        observacao = COALESCE(observacao,'') || E'\n[Renegociado em ' || CURRENT_DATE || ']',
        updated_by = auth.uid(),
        updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND status::text IN ('Pendente','Atrasado')
      AND deleted_at IS NULL;
  ELSE
    UPDATE despesas
    SET status = 'Cancelado'::status_financeiro,
        observacao = COALESCE(observacao,'') || E'\n[Renegociado em ' || CURRENT_DATE || ']',
        updated_by = auth.uid(),
        updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND status::text IN ('Pendente','Atrasado')
      AND deleted_at IS NULL;
  END IF;

  v_novo_grupo_id := public.rpc_grupo_parcela_criar(
    v_grupo.tipo_lancamento,
    v_grupo.descricao || ' (renegociado)',
    p_novo_total,
    p_novo_num_parcelas,
    p_nova_primeira_data,
    v_grupo.periodicidade,
    v_grupo.contraparte_id,
    v_grupo.projeto_id,
    v_grupo.categoria_id,
    v_grupo.centro_custo_id,
    NULL, NULL, NULL,
    p_observacao,
    NULL
  );

  UPDATE grupos_parcela
  SET renegociado_de = p_grupo_id, updated_at = now(), updated_by = auth.uid()
  WHERE id = v_novo_grupo_id;

  RETURN v_novo_grupo_id;
END;
$$;

-- ----------------------------- rpc_grupo_parcela_quitar_antecipado -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_quitar_antecipado(
  p_grupo_id uuid,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_quantidade integer DEFAULT NULL,
  p_desconto_total numeric DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa_id uuid;
  v_tipo text;
  v_afetadas integer := 0;
  v_ids uuid[];
  v_soma numeric;
  v_ultimo uuid;
  v_alvo numeric;
  v_atual numeric;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para quitar antecipado';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_tipo IS NULL THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;
  IF p_desconto_total IS NULL THEN p_desconto_total := 0; END IF;
  IF p_desconto_total < 0 THEN RAISE EXCEPTION 'Desconto não pode ser negativo'; END IF;

  IF v_tipo = 'receita' THEN
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids FROM (
      SELECT id, parcela_numero FROM receitas
      WHERE grupo_parcela = p_grupo_id AND status::text IN ('Pendente','Atrasado') AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST LIMIT COALESCE(p_quantidade, 9999)
    ) sub;
    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    SELECT COALESCE(SUM(valor),0) INTO v_soma FROM receitas WHERE id = ANY(v_ids);
    IF p_desconto_total >= v_soma THEN
      RAISE EXCEPTION 'Desconto (%) maior ou igual ao saldo em aberto (%)', p_desconto_total, v_soma;
    END IF;
    SELECT id INTO v_ultimo FROM receitas WHERE id = ANY(v_ids) ORDER BY parcela_numero DESC NULLS LAST, id LIMIT 1;

    UPDATE receitas SET
      status = 'Recebido'::status_financeiro,
      data_recebimento = p_data_pagamento,
      valor = CASE WHEN p_desconto_total > 0 AND v_soma > 0
                   THEN ROUND(valor * (v_soma - p_desconto_total) / v_soma, 2) ELSE valor END,
      observacao = CASE WHEN p_desconto_total > 0
                   THEN COALESCE(observacao,'') || chr(10) || '[Quitação antecipada — desconto de R$ ' || ROUND(p_desconto_total,2)::text || ' rateado]'
                   ELSE observacao END,
      updated_by = auth.uid(), updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF p_desconto_total > 0 AND v_soma > 0 THEN
      v_alvo := ROUND(v_soma - p_desconto_total, 2);
      SELECT COALESCE(SUM(valor),0) INTO v_atual FROM receitas WHERE id = ANY(v_ids);
      IF v_atual <> v_alvo THEN UPDATE receitas SET valor = valor + (v_alvo - v_atual) WHERE id = v_ultimo; END IF;
    END IF;
  ELSE
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids FROM (
      SELECT id, parcela_numero FROM despesas
      WHERE grupo_parcela = p_grupo_id AND status::text IN ('Pendente','Atrasado') AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST LIMIT COALESCE(p_quantidade, 9999)
    ) sub;
    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    SELECT COALESCE(SUM(valor),0) INTO v_soma FROM despesas WHERE id = ANY(v_ids);
    IF p_desconto_total >= v_soma THEN
      RAISE EXCEPTION 'Desconto (%) maior ou igual ao saldo em aberto (%)', p_desconto_total, v_soma;
    END IF;
    SELECT id INTO v_ultimo FROM despesas WHERE id = ANY(v_ids) ORDER BY parcela_numero DESC NULLS LAST, id LIMIT 1;

    UPDATE despesas SET
      status = 'Pago'::status_financeiro,
      data_pagamento = p_data_pagamento,
      valor = CASE WHEN p_desconto_total > 0 AND v_soma > 0
                   THEN ROUND(valor * (v_soma - p_desconto_total) / v_soma, 2) ELSE valor END,
      observacao = CASE WHEN p_desconto_total > 0
                   THEN COALESCE(observacao,'') || chr(10) || '[Quitação antecipada — desconto de R$ ' || ROUND(p_desconto_total,2)::text || ' rateado]'
                   ELSE observacao END,
      updated_by = auth.uid(), updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF p_desconto_total > 0 AND v_soma > 0 THEN
      v_alvo := ROUND(v_soma - p_desconto_total, 2);
      SELECT COALESCE(SUM(valor),0) INTO v_atual FROM despesas WHERE id = ANY(v_ids);
      IF v_atual <> v_alvo THEN UPDATE despesas SET valor = valor + (v_alvo - v_atual) WHERE id = v_ultimo; END IF;
    END IF;
  END IF;

  RETURN v_afetadas;
END;
$fn$;

-- ----------------------------- update_projeto_completo -----------------------------
-- Gate cirúrgico: a função edita o projeto inteiro (nome, status, datas,
-- disciplinas), não só dinheiro. Só exige can_view_financeiro() quando
-- p_valor_contrato REALMENTE muda em relação ao valor salvo — assim
-- coordenador/user sem financeiro_delegado continua editando os campos
-- não-financeiros do próprio projeto, e só é barrado se tentar alterar o
-- valor de contrato.
CREATE OR REPLACE FUNCTION public.update_projeto_completo(
  p_projeto_id UUID,
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato NUMERIC DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_status TEXT DEFAULT 'Planejamento',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_caller_empresa_id UUID;
  v_projeto_empresa_id UUID;
  v_valor_atual NUMERIC;
BEGIN
  v_user_id := auth.uid();
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT empresa_id, valor_contrato INTO v_projeto_empresa_id, v_valor_atual
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto_empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_valor_contrato IS DISTINCT FROM v_valor_atual AND NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para alterar valor de contrato';
  END IF;

  UPDATE public.projetos SET
    codigo_projeto = p_codigo,
    nome = p_nome,
    cliente_id = p_cliente_id,
    data_inicio = p_data_inicio,
    data_previsao = p_data_previsao,
    data_final = p_data_final,
    valor_contrato = p_valor_contrato,
    observacao = p_observacao,
    localizacao = p_localizacao,
    parcelas = p_parcelas,
    area_m2 = p_area_m2,
    disciplinas = p_disciplinas,
    status = p_status::status_projeto,
    prioridade = p_prioridade,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_projeto_id;
END;
$$;
