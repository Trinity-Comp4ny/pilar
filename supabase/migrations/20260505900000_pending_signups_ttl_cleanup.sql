-- TTL cleanup para pilar_pending_signups (LGPD art. 46)
-- failed/canceled: manter 90 dias (evidência de tentativa)
-- pending abandonados: manter 7 dias (checkout expirado)
-- paid: nunca deletar por esta função (dados necessários para auditoria de cobrança)

CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_signups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.pilar_pending_signups
  WHERE
    (payment_status IN ('failed', 'canceled') AND created_at < now() - interval '90 days')
    OR (payment_status = 'pending' AND created_at < now() - interval '7 days');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_pending_signups() TO service_role;

-- Agendar via pg_cron se disponível (rodar às 3h diariamente)
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-pending-signups',
      '0 3 * * *',
      'SELECT public.cleanup_expired_pending_signups()'
    );
  END IF;
END;
$outer$;
