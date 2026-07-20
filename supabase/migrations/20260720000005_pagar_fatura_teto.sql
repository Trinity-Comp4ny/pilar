-- ACH-FIN-03: pagar_fatura validava apenas valor <= 0, mas não impunha teto.
-- Um valor acima do saldo devedor era aceito e valor_pago ultrapassava
-- valor_total (overpay). Adiciona a checagem de teto. Assinatura idêntica
-- (único overload), então CREATE OR REPLACE preserva grants.

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

  -- Teto: pagamento não pode exceder o saldo devedor (ACH-FIN-03)
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
