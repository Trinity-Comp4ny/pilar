-- Migration: agenda cron diário para trial-expiry-cron via pg_cron + pg_net
--
-- Pré-requisitos (ver docs/DEPLOY_CHECKLIST.md):
--   - Extensão pg_cron habilitada em Database → Extensions
--   - Extensão pg_net habilitada (disponível no Supabase Pro+)
--   - Edge Function trial-expiry-cron deployada com --no-verify-jwt
--   - Variáveis de runtime configuradas via SQL Editor:
--       ALTER DATABASE postgres SET app.supabase_url = 'https://vepnsonbnsimqcsfcagm.supabase.co';
--       ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível — agendar via Supabase Dashboard → Edge Functions → Schedule. Ver docs/DEPLOY_CHECKLIST.md.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-expiry-daily') THEN
    PERFORM cron.unschedule('trial-expiry-daily');
  END IF;

  PERFORM cron.schedule(
    'trial-expiry-daily',
    '0 7 * * *',
    $cron$
    SELECT net.http_post(
      url        := current_setting('app.supabase_url') || '/functions/v1/trial-expiry-cron',
      headers    := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body       := '{}'::jsonb
    );
    $cron$
  );

  RAISE NOTICE 'Cron job trial-expiry-daily agendado: 07:00 UTC / 04:00 BRT';
END;
$$;
