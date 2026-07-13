-- Onda 0 — Financeiro: corrige duas agregações.
-- (1) get_lancamentos_kpis e get_financial_chart_data contavam despesa de CARTÃO em dobro
--     (as compras + a despesa da fatura) por não filtrarem is_fatura_payment=false.
-- (2) get_lancamentos_kpis incluía lançamentos 'Cancelado' (gerados por renegociar grupo)
--     em "a_receber"/"a_pagar" (status <> 'Recebido'/'Pago' pega Cancelado).
-- is_fatura_payment existe só em despesas (confirmado). Cancelado é label do enum status_financeiro.

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lancamentos_kpis(
  p_from text DEFAULT NULL,
  p_to  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $fn$
DECLARE
  v_recebido  numeric := 0;
  v_a_receber numeric := 0;
  v_pago      numeric := 0;
  v_a_pagar   numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE status = 'Recebido'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status <> 'Recebido'), 0)
  INTO v_recebido, v_a_receber
  FROM public.receitas
  WHERE deleted_at IS NULL
    AND status::text <> 'Cancelado'
    AND (p_from IS NULL OR data_vencimento >= p_from::date)
    AND (p_to   IS NULL OR data_vencimento <= p_to::date);

  SELECT
    COALESCE(SUM(valor) FILTER (WHERE status = 'Pago'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status <> 'Pago'), 0)
  INTO v_pago, v_a_pagar
  FROM public.despesas
  WHERE deleted_at IS NULL
    AND status::text <> 'Cancelado'
    AND COALESCE(is_fatura_payment, false) = false
    AND (p_from IS NULL OR data_vencimento >= p_from::date)
    AND (p_to   IS NULL OR data_vencimento <= p_to::date);

  RETURN json_build_object(
    'recebido',   v_recebido,
    'a_receber',  v_a_receber,
    'pago',       v_pago,
    'a_pagar',    v_a_pagar
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_lancamentos_kpis(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_financial_chart_data(
  p_empresa_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_result JSONB;
BEGIN
  IF p_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('month', COALESCE(r.data_recebimento, r.data_vencimento)), 'YYYY-MM') AS mes,
          SUM(CASE WHEN r.status = 'Recebido' THEN r.valor ELSE 0 END)  AS receitas_recebidas,
          SUM(CASE WHEN r.status = 'Pendente' THEN r.valor ELSE 0 END)  AS receitas_pendentes
        FROM public.receitas r
        WHERE r.empresa_id = p_empresa_id
          AND r.deleted_at IS NULL
          AND COALESCE(r.data_recebimento, r.data_vencimento) BETWEEN p_data_inicio AND p_data_fim
        GROUP BY DATE_TRUNC('month', COALESCE(r.data_recebimento, r.data_vencimento))
        ORDER BY 1
      ) t
    ),
    'despesas_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('month', COALESCE(d.data_pagamento, d.data_vencimento)), 'YYYY-MM') AS mes,
          SUM(CASE WHEN d.status = 'Pago'    THEN d.valor ELSE 0 END)  AS despesas_pagas,
          SUM(CASE WHEN d.status = 'Pendente' THEN d.valor ELSE 0 END) AS despesas_pendentes
        FROM public.despesas d
        WHERE d.empresa_id = p_empresa_id
          AND d.deleted_at IS NULL
          AND COALESCE(d.is_fatura_payment, false) = false
          AND COALESCE(d.data_pagamento, d.data_vencimento) BETWEEN p_data_inicio AND p_data_fim
        GROUP BY DATE_TRUNC('month', COALESCE(d.data_pagamento, d.data_vencimento))
        ORDER BY 1
      ) t
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_financial_chart_data(UUID, DATE, DATE) TO authenticated;
