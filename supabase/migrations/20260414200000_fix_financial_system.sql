-- ============================================================================
-- FIX: SISTEMA FINANCEIRO — PARCELAS, FATURAS E VIEWS
-- ============================================================================
-- 1. Adiciona flag is_fatura_payment em despesas para distinguir pagamentos
--    de fatura de despesas normais (evita dupla contagem em relatórios).
-- 2. Recria view_cartao_resumo incluindo conta_pagamento_id (faltante).
-- 3. Atualiza pagar_fatura para setar is_fatura_payment = true.
-- 4. Marca registros existentes de pagamento de fatura.
-- ============================================================================

-- 1. COLUNA is_fatura_payment
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS is_fatura_payment BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_despesas_is_fatura_payment
  ON public.despesas(is_fatura_payment)
  WHERE is_fatura_payment = true;

-- Marcar registros existentes de pagamento de fatura
-- (não depende de fatura_id pois a coluna pode não existir ainda)
UPDATE public.despesas
SET is_fatura_payment = true
WHERE descricao LIKE 'Pgto Fatura %'
  AND cartao_id IS NULL
  AND deleted_at IS NULL;

-- 2. GARANTIR QUE conta_pagamento_id EXISTE EM cartoes_credito
ALTER TABLE public.cartoes_credito
  ADD COLUMN IF NOT EXISTS conta_pagamento_id UUID REFERENCES public.contas(id) ON DELETE SET NULL;

-- 3. RECRIAR view_cartao_resumo COM conta_pagamento_id
DROP VIEW IF EXISTS public.view_cartao_resumo;
CREATE VIEW public.view_cartao_resumo AS
SELECT
  cc.id,
  cc.nome,
  cc.empresa_id,
  cc.dia_fechamento,
  cc.dia_vencimento,
  cc.cor,
  cc.limite,
  cc.conta_pagamento_id,
  COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.cartao_id = cc.id
       AND d.status = 'Pendente'
       AND d.deleted_at IS NULL),
    0
  ) as usado,
  (cc.limite - COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.cartao_id = cc.id
       AND d.status = 'Pendente'
       AND d.deleted_at IS NULL),
    0
  )) as disponivel
FROM public.cartoes_credito cc
WHERE cc.deleted_at IS NULL;

GRANT SELECT ON public.view_cartao_resumo TO authenticated;

-- 4. GARANTIR QUE fatura_id EXISTE EM despesas (necessário para pagar_fatura)
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS fatura_id UUID;

-- 5. ATUALIZAR pagar_fatura PARA SETAR is_fatura_payment
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
  -- Lock e buscar fatura
  SELECT f.*, cc.nome as cartao_nome
  INTO v_fatura
  FROM faturas f
  JOIN cartoes_credito cc ON f.cartao_id = cc.id
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

  -- Calcular valor a pagar
  v_valor_a_pagar := COALESCE(p_valor_pago, v_fatura.valor_total - v_fatura.valor_pago);

  IF v_valor_a_pagar <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  -- 1. Atualizar fatura
  UPDATE faturas SET
    valor_pago = valor_pago + v_valor_a_pagar,
    conta_pagamento_id = p_conta_id,
    data_pagamento = p_data_pagamento,
    status = CASE
      WHEN (valor_pago + v_valor_a_pagar) >= valor_total THEN 'Paga'
      ELSE 'Parcial'
    END
  WHERE id = p_fatura_id;

  -- 2. Se totalmente paga, marcar despesas do cartão como Pago
  IF (v_fatura.valor_pago + v_valor_a_pagar) >= v_fatura.valor_total THEN
    UPDATE despesas SET
      status = 'Pago',
      data_pagamento = p_data_pagamento
    WHERE fatura_id = p_fatura_id
      AND cartao_id IS NOT NULL
      AND deleted_at IS NULL
      AND status = 'Pendente';
  END IF;

  -- 3. Criar débito na conta bancária (marcado como pagamento de fatura)
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
