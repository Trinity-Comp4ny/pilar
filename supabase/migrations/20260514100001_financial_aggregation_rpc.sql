-- Migration: RPC para agregação financeira de gráficos
-- Evita processar milhares de registros no frontend; agrega no banco por mês.
-- Receitas usam data_recebimento (quando disponível) ou data_vencimento.
-- Despesas usam data_pagamento (quando disponível) ou data_vencimento.

DROP FUNCTION IF EXISTS public.get_financial_chart_data(UUID, DATE, DATE);

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
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Valida acesso: o caller deve pertencer à empresa solicitada
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
          AND COALESCE(d.data_pagamento, d.data_vencimento) BETWEEN p_data_inicio AND p_data_fim
        GROUP BY DATE_TRUNC('month', COALESCE(d.data_pagamento, d.data_vencimento))
        ORDER BY 1
      ) t
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_chart_data(UUID, DATE, DATE) TO authenticated;
