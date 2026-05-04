-- P1.1+P1.2 — Alocação automática de despesa de cartão na fatura correta
-- Existem: tabela faturas, RPCs gerar_fatura e pagar_fatura.
-- Gap: ao INSERIR despesa com cartao_id, fatura_id não é preenchido automaticamente —
-- usuário precisa rodar gerar_fatura manualmente. Esta migration fecha o ciclo.

-- =====================================================================
-- 1. Helper: find_or_create_fatura por (cartão, data_compra)
-- =====================================================================
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
  FROM cartoes_credito
  WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_cartao IS NULL OR v_cartao.dia_fechamento IS NULL THEN
    RETURN NULL;
  END IF;

  v_empresa_id := v_cartao.empresa_id;
  v_dia_compra := EXTRACT(DAY FROM p_data_compra)::int;

  -- Se compra antes do fechamento → fatura do mês corrente
  -- Se compra >= fechamento → fatura do mês seguinte
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

  -- Tenta achar fatura existente
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

  -- Cria a fatura (mesma lógica do RPC gerar_fatura, sem requerer auth.uid)
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

GRANT EXECUTE ON FUNCTION public.find_or_create_fatura(uuid, date) TO authenticated;

-- =====================================================================
-- 2. Trigger: aloca despesa na fatura certa no INSERT/UPDATE
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tr_alocar_despesa_fatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura_id uuid;
  v_data_ref date;
BEGIN
  -- Pula pagamentos de fatura (não devem ir para outra fatura)
  IF COALESCE(NEW.is_fatura_payment, false) THEN
    RETURN NEW;
  END IF;

  -- Só age quando cartao_id presente e fatura_id ainda vazio
  IF NEW.cartao_id IS NULL OR NEW.fatura_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Usa data_competencia (data da compra) se houver, senão data_vencimento, senão hoje
  v_data_ref := COALESCE(NEW.data_competencia, NEW.data_vencimento, CURRENT_DATE);

  v_fatura_id := public.find_or_create_fatura(NEW.cartao_id, v_data_ref);

  IF v_fatura_id IS NOT NULL THEN
    NEW.fatura_id := v_fatura_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_alocar_despesa_fatura ON public.despesas;
CREATE TRIGGER tr_alocar_despesa_fatura
  BEFORE INSERT OR UPDATE OF cartao_id, data_competencia, data_vencimento
  ON public.despesas
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_alocar_despesa_fatura();

-- =====================================================================
-- 3. Trigger: recalc valor_total da fatura quando despesa muda
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tr_recalc_fatura_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura_id uuid;
  v_total numeric(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_fatura_id := OLD.fatura_id;
  ELSE
    v_fatura_id := NEW.fatura_id;
    -- Se mudou de fatura, recalcula a antiga também
    IF TG_OP = 'UPDATE' AND OLD.fatura_id IS DISTINCT FROM NEW.fatura_id
       AND OLD.fatura_id IS NOT NULL THEN
      SELECT COALESCE(SUM(valor), 0) INTO v_total
      FROM despesas
      WHERE fatura_id = OLD.fatura_id
        AND cartao_id IS NOT NULL
        AND COALESCE(is_fatura_payment, false) = false
        AND deleted_at IS NULL;
      UPDATE faturas SET valor_total = v_total WHERE id = OLD.fatura_id;
    END IF;
  END IF;

  IF v_fatura_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND COALESCE(is_fatura_payment, false) = false
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_total WHERE id = v_fatura_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_recalc_fatura_total ON public.despesas;
CREATE TRIGGER tr_recalc_fatura_total
  AFTER INSERT OR UPDATE OF valor, fatura_id, deleted_at
     OR DELETE
  ON public.despesas
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_recalc_fatura_total();

-- =====================================================================
-- 4. View lancamentos: incluir fatura_id
-- =====================================================================
DROP VIEW IF EXISTS public.lancamentos;

CREATE VIEW public.lancamentos
  WITH (security_invoker = true)
AS
SELECT
  r.id, r.empresa_id, 'receita'::text AS tipo, r.descricao, r.valor,
  r.data_vencimento, r.data_recebimento AS data_efetivacao, r.data_competencia,
  r.status::text AS status, r.categoria_id, r.projeto_id, r.conta_id,
  r.centro_custo_id, r.tags,
  r.cliente_id AS contraparte_id, 'cliente'::text AS contraparte_tipo,
  NULL::uuid AS cartao_id, NULL::uuid AS fatura_id,
  r.forma_pagamento,
  r.grupo_parcela, r.parcela_numero, r.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  r.nota_fiscal, r.observacao,
  r.created_by, r.updated_by, r.created_at, r.updated_at, r.deleted_at
FROM public.receitas r
LEFT JOIN public.grupos_parcela gp ON gp.id = r.grupo_parcela
WHERE r.deleted_at IS NULL

UNION ALL

SELECT
  d.id, d.empresa_id, 'despesa'::text AS tipo, d.descricao, d.valor,
  d.data_vencimento, d.data_pagamento AS data_efetivacao, d.data_competencia,
  d.status::text AS status, d.categoria_id, d.projeto_id, d.conta_id,
  d.centro_custo_id, d.tags,
  d.fornecedor_id AS contraparte_id, 'fornecedor'::text AS contraparte_tipo,
  d.cartao_id, d.fatura_id,
  d.forma_pagamento,
  d.grupo_parcela, d.parcela_numero, d.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  d.nota_fiscal, d.observacao,
  d.created_by, d.updated_by, d.created_at, d.updated_at, d.deleted_at
FROM public.despesas d
LEFT JOIN public.grupos_parcela gp ON gp.id = d.grupo_parcela
WHERE d.deleted_at IS NULL;

GRANT SELECT ON public.lancamentos TO authenticated;
