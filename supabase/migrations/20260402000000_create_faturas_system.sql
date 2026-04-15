-- ============================================================================
-- SISTEMA DE FATURAS DE CARTÃO DE CRÉDITO
-- ============================================================================
-- Cria o conceito de "fatura" para agrupar despesas de cartão por ciclo mensal.
-- Ao pagar uma fatura, o valor é debitado de uma conta bancária, as despesas
-- mudam para "Pago", e o limite do cartão é restaurado automaticamente.
-- ============================================================================

-- 1. TABELA FATURAS
CREATE TABLE IF NOT EXISTS public.faturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cartao_id UUID NOT NULL REFERENCES public.cartoes_credito(id) ON DELETE RESTRICT,
  mes_referencia INTEGER NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
  ano_referencia INTEGER NOT NULL CHECK (ano_referencia BETWEEN 2020 AND 2100),

  -- Ciclo de billing (calculado na criação)
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  data_vencimento DATE NOT NULL,

  -- Valores
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_pago DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Status e pagamento
  status TEXT NOT NULL DEFAULT 'Aberta'
    CHECK (status IN ('Aberta', 'Fechada', 'Paga', 'Parcial')),
  conta_pagamento_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  data_pagamento DATE,

  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Uma fatura por cartão por mês
  CONSTRAINT faturas_unique_cartao_mes UNIQUE (cartao_id, mes_referencia, ano_referencia)
);

-- 2. COLUNA fatura_id NA TABELA DESPESAS
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL;

-- 3. COLUNA conta_pagamento_id NA TABELA CARTOES_CREDITO
ALTER TABLE public.cartoes_credito
  ADD COLUMN IF NOT EXISTS conta_pagamento_id UUID REFERENCES public.contas(id) ON DELETE SET NULL;

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_faturas_empresa ON public.faturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao ON public.faturas(cartao_id);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON public.faturas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_periodo ON public.faturas(cartao_id, ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_despesas_fatura ON public.despesas(fatura_id);

-- 5. TRIGGERS (auditoria e soft delete)
CREATE TRIGGER tr_audit_faturas
  BEFORE INSERT OR UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_soft_del_faturas
  BEFORE DELETE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- 6. RLS
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faturas_select" ON public.faturas
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "faturas_insert" ON public.faturas
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "faturas_update" ON public.faturas
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.has_role('admin', 'financeiro')
  ) WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "faturas_delete" ON public.faturas
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

-- 7. VIEW: RESUMO DE FATURAS
CREATE OR REPLACE VIEW public.view_fatura_resumo AS
SELECT
  f.id,
  f.empresa_id,
  f.cartao_id,
  cc.nome as cartao_nome,
  cc.cor as cartao_cor,
  f.mes_referencia,
  f.ano_referencia,
  f.data_inicio,
  f.data_fim,
  f.data_vencimento,
  f.status,
  f.data_pagamento,
  f.conta_pagamento_id,
  c.nome as conta_pagamento_nome,
  COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.fatura_id = f.id
       AND d.cartao_id IS NOT NULL
       AND d.deleted_at IS NULL),
    0
  ) as valor_total,
  f.valor_pago,
  (SELECT COUNT(*)
   FROM public.despesas d
   WHERE d.fatura_id = f.id
     AND d.cartao_id IS NOT NULL
     AND d.deleted_at IS NULL) as qtd_despesas
FROM public.faturas f
JOIN public.cartoes_credito cc ON f.cartao_id = cc.id
LEFT JOIN public.contas c ON f.conta_pagamento_id = c.id
WHERE f.deleted_at IS NULL;

-- 8. RPC: GERAR FATURA
-- Cria a fatura para um cartão+mês (idempotente) e associa despesas não vinculadas.
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
  -- Buscar dados do cartão
  SELECT dia_fechamento, dia_vencimento, empresa_id
  INTO v_dia_fechamento, v_dia_vencimento, v_empresa_id
  FROM cartoes_credito WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_dia_fechamento IS NULL THEN
    RAISE EXCEPTION 'Cartão não encontrado';
  END IF;

  -- Verificação de segurança
  IF v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Calcular datas do ciclo
  -- data_fim = dia_fechamento do mês de referência (limitado ao último dia do mês)
  v_max_day_fim := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_fim := make_date(p_ano, p_mes, LEAST(v_dia_fechamento, v_max_day_fim));

  -- data_inicio = dia_fechamento+1 do mês anterior
  v_data_inicio := (v_data_fim - INTERVAL '1 month')::DATE + INTERVAL '1 day';

  -- data_vencimento = dia_vencimento do mês de referência
  v_max_day_venc := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_vencimento := make_date(p_ano, p_mes, LEAST(v_dia_vencimento, v_max_day_venc));

  -- Se dia_vencimento < dia_fechamento, o vencimento é no mês seguinte
  IF v_dia_vencimento < v_dia_fechamento THEN
    v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
  END IF;

  -- Upsert da fatura
  INSERT INTO faturas (empresa_id, cartao_id, mes_referencia, ano_referencia,
                       data_inicio, data_fim, data_vencimento, status)
  VALUES (v_empresa_id, p_cartao_id, p_mes, p_ano,
          v_data_inicio, v_data_fim, v_data_vencimento, 'Aberta')
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_fatura_id;

  -- Associar despesas não vinculadas ao ciclo
  UPDATE despesas
  SET fatura_id = v_fatura_id
  WHERE cartao_id = p_cartao_id
    AND deleted_at IS NULL
    AND data_vencimento >= v_data_inicio
    AND data_vencimento <= v_data_fim
    AND fatura_id IS NULL;

  -- Atualizar total da fatura
  SELECT COALESCE(SUM(valor), 0) INTO v_valor_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_valor_total WHERE id = v_fatura_id;

  RETURN v_fatura_id;
END;
$$;

-- 9. RPC: PAGAR FATURA
-- Paga uma fatura: marca despesas como Pago, cria débito na conta bancária.
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

  -- 3. Criar débito na conta bancária
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
    observacao
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
    'Pagamento de fatura de cartão de crédito'
  );
END;
$$;
