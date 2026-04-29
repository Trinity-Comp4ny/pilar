-- Sprint 3 — LGPD: TTL para pilar_pending_signups
-- L1: signups pendentes acumulam CPF/e-mail indefinidamente (LGPD art. 46)
--     Dados de pagamento de checkout falho devem ser removidos após 30 dias

-- Função de limpeza (chamável por pg_cron ou Edge Function agendada)
CREATE OR REPLACE FUNCTION public.cleanup_pending_signups()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.pilar_pending_signups
  WHERE payment_status IN ('failed', 'canceled')
    AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_pending_signups() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.cleanup_pending_signups() IS
  'LGPD art. 46 — remove signups com payment_status failed/canceled com mais de 30 dias.
   Chamar via pg_cron (diário) ou Edge Function agendada (cron schedule).';
