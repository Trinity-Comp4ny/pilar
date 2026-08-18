-- rate_limit_cleanup() existe desde 20260836000000 mas nunca rodou: a tentativa de
-- agendamento em 024_hardening_final.sql (25/04) ficou condicionada a pg_cron já
-- instalado, e a extensão só foi habilitada em staging/prod meses depois (para o job
-- de alertas ambient). Resultado: rate_limit_attempts cresce sem limpeza desde então
-- (confirmado ao vivo: 380 linhas em staging desde 14/07, 75 em prod desde 08/05).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron indisponível — rode SELECT public.rate_limit_cleanup() manualmente ou agende no Dashboard.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup') THEN
    PERFORM cron.unschedule('rate-limit-cleanup');
  END IF;

  PERFORM cron.schedule(
    'rate-limit-cleanup',
    '0 4 * * *',
    $cron$ SELECT public.rate_limit_cleanup() $cron$
  );

  RAISE NOTICE 'Cron rate-limit-cleanup agendado: 04:00 UTC diário.';
END;
$$;
