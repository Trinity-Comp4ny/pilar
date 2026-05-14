-- Migration: agenda cron diário para trial-expiry-cron via pg_cron + pg_net
--
-- Pré-requisitos (já listados em docs/DEPLOY_CHECKLIST.md):
--   - Extensão pg_cron habilitada em Database → Extensions
--   - Extensão pg_net habilitada (disponível no Supabase Pro+)
--   - Edge Function trial-expiry-cron deployada com --no-verify-jwt
--   - app.supabase_url e app.service_role_key configurados (ver bloco abaixo)
--
-- Para configurar as variáveis de runtime no Supabase:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
-- (Rodar via SQL Editor com usuário postgres, não expor em migrations versionadas)

DO $$
BEGIN
  -- Verifica se pg_cron está disponível
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE NOTICE 'pg_cron não disponível — agendar via Supabase Dashboard → Edge Functions → Schedule ou cron externo. Ver docs/DEPLOY_CHECKLIST.md seção trial-expiry-cron.';
    RETURN;
  END IF;

  -- Remove job anterior se existir (idempotente)
  PERFORM cron.unschedule('trial-expiry-daily')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'trial-expiry-daily'
  );

  -- Roda todo dia às 7h UTC (4h Brasília)
  PERFORM cron.schedule(
    'trial-expiry-daily',
    '0 7 * * *',
    $$
    SELECT net.http_post(
      url        := current_setting('app.supabase_url') || '/functions/v1/trial-expiry-cron',
      headers    := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body       := '{}'::jsonb
    );
    $$
  );

  RAISE NOTICE 'Cron job trial-expiry-daily agendado para 0 7 * * * (07:00 UTC / 04:00 BRT)';
END;
$$;
