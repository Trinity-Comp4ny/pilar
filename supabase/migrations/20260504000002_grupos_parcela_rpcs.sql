-- P0.3 — RPCs de operações de grupo de parcela
-- Operações: criar, editar em aberto, renegociar, quitar antecipado.
-- Todas validam empresa via get_user_empresa_id() e usam SECURITY DEFINER.

-- =====================================================================
-- 1. Criar grupo + parcelas (substitui o padrão "insere N receitas com mesmo UUID")
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_criar(
  p_tipo_lancamento text,           -- 'receita' | 'despesa'
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

  -- Cria grupo
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

  -- Cria parcelas filhas
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

GRANT EXECUTE ON FUNCTION public.rpc_grupo_parcela_criar(
  text, text, numeric, integer, date, text, uuid, uuid, uuid, uuid,
  uuid, uuid, text, text, text[]
) TO authenticated;

-- =====================================================================
-- 2. Editar parcelas em aberto (preserva pagas)
-- =====================================================================
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

GRANT EXECUTE ON FUNCTION public.rpc_grupo_parcela_editar_em_aberto(
  uuid, numeric, uuid, uuid, uuid, text
) TO authenticated;

-- =====================================================================
-- 3. Renegociar grupo (cria novo grupo, cancela em aberto, mantém histórico)
-- =====================================================================
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
  v_empresa_id := public.get_user_empresa_id();

  SELECT * INTO v_grupo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_grupo IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado ou acesso negado';
  END IF;

  -- Cancela parcelas em aberto do grupo antigo
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

  -- Cria novo grupo via rpc_grupo_parcela_criar
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

  -- Marca link com grupo antigo
  UPDATE grupos_parcela
  SET renegociado_de = p_grupo_id, updated_at = now(), updated_by = auth.uid()
  WHERE id = v_novo_grupo_id;

  RETURN v_novo_grupo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_grupo_parcela_renegociar(
  uuid, numeric, integer, date, text
) TO authenticated;

-- =====================================================================
-- 4. Quitar antecipado (baixa N parcelas em aberto numa data)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_quitar_antecipado(
  p_grupo_id uuid,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_quantidade integer DEFAULT NULL,    -- NULL = todas em aberto
  p_desconto_total numeric DEFAULT 0
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
  v_status_pago text;
  v_data_field text;
  v_ids uuid[];
  v_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  IF v_tipo = 'receita' THEN
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids
    FROM (
      SELECT id, parcela_numero FROM receitas
      WHERE grupo_parcela = p_grupo_id
        AND status::text IN ('Pendente','Atrasado')
        AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST
      LIMIT COALESCE(p_quantidade, 9999)
    ) sub;

    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    UPDATE receitas
    SET status = 'Recebido'::status_financeiro,
        data_recebimento = p_data_pagamento,
        observacao = CASE WHEN p_desconto_total > 0
          THEN COALESCE(observacao,'') || E'\n[Quitação antecipada — desconto rateado]'
          ELSE observacao END,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  ELSE
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids
    FROM (
      SELECT id, parcela_numero FROM despesas
      WHERE grupo_parcela = p_grupo_id
        AND status::text IN ('Pendente','Atrasado')
        AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST
      LIMIT COALESCE(p_quantidade, 9999)
    ) sub;

    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    UPDATE despesas
    SET status = 'Pago'::status_financeiro,
        data_pagamento = p_data_pagamento,
        observacao = CASE WHEN p_desconto_total > 0
          THEN COALESCE(observacao,'') || E'\n[Quitação antecipada — desconto rateado]'
          ELSE observacao END,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  END IF;

  RETURN v_afetadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_grupo_parcela_quitar_antecipado(
  uuid, date, integer, numeric
) TO authenticated;
