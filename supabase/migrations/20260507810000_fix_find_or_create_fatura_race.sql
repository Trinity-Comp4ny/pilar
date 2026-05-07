-- DB-A2: Fix race condition in find_or_create_fatura
-- Old: SELECT then INSERT ON CONFLICT with RETURNING — race between SELECT and INSERT
-- New: INSERT ON CONFLICT DO UPDATE (touch updated_at), then SELECT to get id
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

  v_max_dia := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(v_ano_ref, v_mes_ref, 1)) + INTERVAL '1 month - 1 day'))::int;
  v_data_fim := make_date(v_ano_ref, v_mes_ref, LEAST(v_cartao.dia_fechamento, v_max_dia));
  v_data_inicio := (v_data_fim - INTERVAL '1 month')::date + INTERVAL '1 day';
  v_data_venc := make_date(v_ano_ref, v_mes_ref, LEAST(v_cartao.dia_vencimento, v_max_dia));
  IF v_cartao.dia_vencimento < v_cartao.dia_fechamento THEN
    v_data_venc := v_data_venc + INTERVAL '1 month';
  END IF;

  -- Upsert then select: eliminates race condition between concurrent callers
  INSERT INTO faturas (
    empresa_id, cartao_id, mes_referencia, ano_referencia,
    data_inicio, data_fim, data_vencimento, status
  ) VALUES (
    v_empresa_id, p_cartao_id, v_mes_ref, v_ano_ref,
    v_data_inicio, v_data_fim, v_data_venc, 'Aberta'
  )
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = now();

  SELECT id INTO v_fatura_id
  FROM faturas
  WHERE cartao_id = p_cartao_id
    AND mes_referencia = v_mes_ref
    AND ano_referencia = v_ano_ref
    AND deleted_at IS NULL
  LIMIT 1;

  RETURN v_fatura_id;
END;
$$;
