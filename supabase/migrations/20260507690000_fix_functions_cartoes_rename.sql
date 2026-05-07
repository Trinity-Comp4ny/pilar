-- Fix gerar_fatura, pagar_fatura, find_or_create_fatura: cartoes_credito was renamed to cartoes
-- but these functions still reference the old name.

CREATE OR REPLACE FUNCTION public.find_or_create_fatura(
  p_cartao_id uuid,
  p_data_compra date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cartao record;
  v_empresa_id uuid;
  v_dia_compra int;
  v_mes_ref int;
  v_ano_ref int;
  v_fatura_id uuid;
  v_data_inicio date;
  v_data_fim date;
  v_data_venc date;
  v_max_dia int;
BEGIN
  SELECT id, empresa_id, dia_fechamento, dia_vencimento
  INTO v_cartao
  FROM cartoes
  WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_cartao IS NULL OR v_cartao.dia_fechamento IS NULL THEN
    RETURN NULL;
  END IF;

  v_empresa_id := v_cartao.empresa_id;
  v_dia_compra := EXTRACT(DAY FROM p_data_compra)::int;

  IF v_dia_compra < v_cartao.dia_fechamento THEN
    v_mes_ref := EXTRACT(MONTH FROM p_data_compra)::int;
    v_ano_ref := EXTRACT(YEAR FROM p_data_compra)::int;
  ELSE
    v_mes_ref := EXTRACT(MONTH FROM p_data_compra)::int + 1;
    v_ano_ref := EXTRACT(YEAR FROM p_data_compra)::int;
    IF v_mes_ref > 12 THEN
      v_mes_ref := 1;
      v_ano_ref := v_ano_ref + 1;
    END IF;
  END IF;

  SELECT id INTO v_fatura_id
  FROM faturas
  WHERE cartao_id = p_cartao_id
    AND mes_referencia = v_mes_ref
    AND ano_referencia = v_ano_ref
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_fatura_id IS NOT NULL THEN
    RETURN v_fatura_id;
  END IF;

  v_max_dia := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(v_ano_ref, v_mes_ref, 1)) + INTERVAL '1 month - 1 day'))::int;
  v_data_fim := make_date(v_ano_ref, v_mes_ref, LEAST(v_cartao.dia_fechamento, v_max_dia));
  v_data_inicio := (v_data_fim - INTERVAL '1 month')::date + INTERVAL '1 day';
  v_data_venc := make_date(v_ano_ref, v_mes_ref, LEAST(v_cartao.dia_vencimento, v_max_dia));
  IF v_cartao.dia_vencimento < v_cartao.dia_fechamento THEN
    v_data_venc := v_data_venc + INTERVAL '1 month';
  END IF;

  INSERT INTO faturas (
    empresa_id, cartao_id, mes_referencia, ano_referencia,
    data_inicio, data_fim, data_vencimento, status
  ) VALUES (
    v_empresa_id, p_cartao_id, v_mes_ref, v_ano_ref,
    v_data_inicio, v_data_fim, v_data_venc, 'Aberta'
  )
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_fatura_id;

  RETURN v_fatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_fatura(
  p_cartao_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura_id UUID;
  v_dia_fechamento INTEGER;
  v_dia_vencimento INTEGER;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_data_vencimento DATE;
  v_empresa_id UUID;
  v_valor_total DECIMAL(12,2);
  v_max_day_fim INTEGER;
  v_max_day_venc INTEGER;
BEGIN
  SELECT dia_fechamento, dia_vencimento, empresa_id
  INTO v_dia_fechamento, v_dia_vencimento, v_empresa_id
  FROM cartoes WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_dia_fechamento IS NULL THEN
    RAISE EXCEPTION 'Cartão não encontrado';
  END IF;

  IF v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_max_day_fim := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_fim := make_date(p_ano, p_mes, LEAST(v_dia_fechamento, v_max_day_fim));

  v_data_inicio := (v_data_fim - INTERVAL '1 month')::DATE + INTERVAL '1 day';

  v_max_day_venc := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_vencimento := make_date(p_ano, p_mes, LEAST(v_dia_vencimento, v_max_day_venc));

  IF v_dia_vencimento < v_dia_fechamento THEN
    v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
  END IF;

  INSERT INTO faturas (empresa_id, cartao_id, mes_referencia, ano_referencia,
                       data_inicio, data_fim, data_vencimento, status)
  VALUES (v_empresa_id, p_cartao_id, p_mes, p_ano,
          v_data_inicio, v_data_fim, v_data_vencimento, 'Aberta')
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_fatura_id;

  UPDATE despesas
  SET fatura_id = v_fatura_id
  WHERE cartao_id = p_cartao_id
    AND deleted_at IS NULL
    AND data_vencimento >= v_data_inicio
    AND data_vencimento <= v_data_fim
    AND fatura_id IS NULL;

  SELECT COALESCE(SUM(valor), 0) INTO v_valor_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_valor_total WHERE id = v_fatura_id;

  RETURN v_fatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pagar_fatura(
  p_fatura_id UUID,
  p_conta_id UUID,
  p_valor_pago DECIMAL(12,2) DEFAULT NULL,
  p_data_pagamento DATE DEFAULT CURRENT_DATE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura RECORD;
  v_valor_a_pagar DECIMAL(12,2);
BEGIN
  SELECT f.*, cc.nome as cartao_nome
  INTO v_fatura
  FROM faturas f
  JOIN cartoes cc ON f.cartao_id = cc.id
  WHERE f.id = p_fatura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;

  IF v_fatura IS NULL THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;

  IF v_fatura.empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_fatura.status = 'Paga' THEN
    RAISE EXCEPTION 'Fatura já está paga';
  END IF;

  v_valor_a_pagar := COALESCE(p_valor_pago, v_fatura.valor_total - v_fatura.valor_pago);

  IF v_valor_a_pagar <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  UPDATE faturas SET
    valor_pago = valor_pago + v_valor_a_pagar,
    conta_pagamento_id = p_conta_id,
    data_pagamento = p_data_pagamento,
    status = CASE
      WHEN (valor_pago + v_valor_a_pagar) >= valor_total THEN 'Paga'
      ELSE 'Parcial'
    END
  WHERE id = p_fatura_id;

  IF (v_fatura.valor_pago + v_valor_a_pagar) >= v_fatura.valor_total THEN
    UPDATE despesas SET
      status = 'Pago',
      data_pagamento = p_data_pagamento
    WHERE fatura_id = p_fatura_id
      AND cartao_id IS NOT NULL
      AND deleted_at IS NULL
      AND status = 'Pendente';
  END IF;

  INSERT INTO despesas (
    empresa_id,
    descricao,
    valor,
    data_vencimento,
    data_pagamento,
    status,
    conta_id,
    cartao_id,
    fatura_id,
    observacao,
    is_fatura_payment
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
$$;
