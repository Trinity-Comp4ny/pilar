-- RPC que agrega KPIs de lançamentos server-side.
-- Substitui os 2 SELECTs full-table disparados client-side por troca de filtro.
-- SECURITY INVOKER: RLS de receitas/despesas se aplica normalmente via auth.uid().
CREATE OR REPLACE FUNCTION public.get_lancamentos_kpis(
  p_from text DEFAULT NULL,
  p_to  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
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
    AND (p_from IS NULL OR data_vencimento >= p_from::date)
    AND (p_to   IS NULL OR data_vencimento <= p_to::date);

  SELECT
    COALESCE(SUM(valor) FILTER (WHERE status = 'Pago'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status <> 'Pago'), 0)
  INTO v_pago, v_a_pagar
  FROM public.despesas
  WHERE deleted_at IS NULL
    AND (p_from IS NULL OR data_vencimento >= p_from::date)
    AND (p_to   IS NULL OR data_vencimento <= p_to::date);

  RETURN json_build_object(
    'recebido',   v_recebido,
    'a_receber',  v_a_receber,
    'pago',       v_pago,
    'a_pagar',    v_a_pagar
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lancamentos_kpis(text, text) TO authenticated;
