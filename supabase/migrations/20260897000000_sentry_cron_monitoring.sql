-- Migration: Sentry Cron Monitoring (Insights > Crons) via check-in HTTP puro
-- Ver ADR 0036.
--
-- Pré-requisito manual por ambiente (staging e produção), igual ao padrão já usado
-- para app.supabase_url/app.service_role_key (20260514300002_setup_trial_expiry_cron.sql):
--   ALTER DATABASE postgres SET app.sentry_dsn = 'https://<public_key>@<host>/<project_id>';
-- (a mesma DSN pública usada em VITE_SENTRY_DSN/SENTRY_DSN, não é segredo novo, só um
-- lugar novo pra ela viver). Sem o setting, sentry_cron_checkin() é no-op silencioso,
-- dev local nunca quebra por falta dele.

CREATE OR REPLACE FUNCTION public.sentry_cron_checkin(p_monitor_slug text, p_status text, p_check_in_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_dsn text;
  v_match text[];
  v_check_in_id uuid := COALESCE(p_check_in_id, gen_random_uuid());
  v_url text;
BEGIN
  BEGIN
    v_dsn := current_setting('app.sentry_dsn', true);
  EXCEPTION WHEN OTHERS THEN
    v_dsn := NULL;
  END;

  IF v_dsn IS NULL OR v_dsn = '' THEN
    RETURN v_check_in_id;
  END IF;

  -- DSN: https://<public_key>@<host>/<project_id>
  v_match := regexp_match(v_dsn, '^https://([^@]+)@([^/]+)/(.+)$');
  IF v_match IS NULL THEN
    RAISE WARNING 'sentry_cron_checkin: app.sentry_dsn em formato inesperado, check-in pulado';
    RETURN v_check_in_id;
  END IF;

  v_url := format(
    'https://%s/api/%s/cron/%s/%s/?status=%s&check_in_id=%s&environment=%s',
    v_match[2], v_match[3], p_monitor_slug, v_match[1], p_status, v_check_in_id,
    COALESCE(current_setting('app.sentry_env', true), 'production')
  );

  -- Fire-and-forget: pg_net enfileira e processa em background, nunca bloqueia o
  -- job real. Falha de rede aqui não pode derrubar o cron (por isso o EXCEPTION
  -- amplo), pior caso é o Sentry achar que o job não rodou, não o job falhar de fato.
  BEGIN
    PERFORM net.http_get(v_url);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sentry_cron_checkin: falha ao enviar check-in (%)', SQLERRM;
  END;

  RETURN v_check_in_id;
END;
$$;

COMMENT ON FUNCTION public.sentry_cron_checkin IS
  'Check-in HTTP no Sentry Crons (Insights > Crons) para um pg_cron job. Ver ADR 0036.';

-- === gerar-notificacoes-ambient (06:00 diário) ===
CREATE OR REPLACE FUNCTION public.gerar_notificacoes_ambient_monitored()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_id uuid;
BEGIN
  v_check_in_id := public.sentry_cron_checkin('gerar-notificacoes-ambient', 'in_progress');
  BEGIN
    PERFORM public.gerar_notificacoes_ambient();
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sentry_cron_checkin('gerar-notificacoes-ambient', 'error', v_check_in_id);
    RAISE;
  END;
  PERFORM public.sentry_cron_checkin('gerar-notificacoes-ambient', 'ok', v_check_in_id);
END;
$$;

-- === audit-log-cleanup (03:00 domingo) ===
CREATE OR REPLACE FUNCTION public.audit_log_cleanup_monitored()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_id uuid;
BEGIN
  v_check_in_id := public.sentry_cron_checkin('audit-log-cleanup', 'in_progress');
  BEGIN
    PERFORM public.audit_log_cleanup();
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sentry_cron_checkin('audit-log-cleanup', 'error', v_check_in_id);
    RAISE;
  END;
  PERFORM public.sentry_cron_checkin('audit-log-cleanup', 'ok', v_check_in_id);
END;
$$;

-- === rate-limit-cleanup (04:00 diário) ===
CREATE OR REPLACE FUNCTION public.rate_limit_cleanup_monitored()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_id uuid;
BEGIN
  v_check_in_id := public.sentry_cron_checkin('rate-limit-cleanup', 'in_progress');
  BEGIN
    PERFORM public.rate_limit_cleanup();
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sentry_cron_checkin('rate-limit-cleanup', 'error', v_check_in_id);
    RAISE;
  END;
  PERFORM public.sentry_cron_checkin('rate-limit-cleanup', 'ok', v_check_in_id);
END;
$$;

-- === cleanup-pending-signups (03:00 diário) ===
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_signups_monitored()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_id uuid;
BEGIN
  v_check_in_id := public.sentry_cron_checkin('cleanup-pending-signups', 'in_progress');
  BEGIN
    PERFORM public.cleanup_expired_pending_signups();
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sentry_cron_checkin('cleanup-pending-signups', 'error', v_check_in_id);
    RAISE;
  END;
  PERFORM public.sentry_cron_checkin('cleanup-pending-signups', 'ok', v_check_in_id);
END;
$$;

-- Reagenda os 4 jobs SQL-diretos para chamar o wrapper monitorado.
-- trial-expiry-daily NÃO entra aqui: já chama uma edge function via net.http_post
-- (própria envolvida por withSentry, que já reporta exceção/transaction), e
-- instrumentá-la aqui duplicaria sinal sem checar o resultado real da function
-- (net.http_post é fire-and-forget, não dá pra amarrar ok/error ao response).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível: nada a reagendar (dev local sem a extensão).';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-notificacoes-ambient') THEN
    PERFORM cron.unschedule('gerar-notificacoes-ambient');
  END IF;
  PERFORM cron.schedule('gerar-notificacoes-ambient', '0 6 * * *', 'SELECT public.gerar_notificacoes_ambient_monitored();');

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit-log-cleanup') THEN
    PERFORM cron.unschedule('audit-log-cleanup');
  END IF;
  PERFORM cron.schedule('audit-log-cleanup', '0 3 * * 0', 'SELECT public.audit_log_cleanup_monitored();');

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup') THEN
    PERFORM cron.unschedule('rate-limit-cleanup');
  END IF;
  PERFORM cron.schedule('rate-limit-cleanup', '0 4 * * *', 'SELECT public.rate_limit_cleanup_monitored();');

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-pending-signups') THEN
    PERFORM cron.unschedule('cleanup-pending-signups');
  END IF;
  PERFORM cron.schedule('cleanup-pending-signups', '0 3 * * *', 'SELECT public.cleanup_expired_pending_signups_monitored();');

  RAISE NOTICE 'Cron monitoring (Sentry Crons) ligado para os 4 jobs SQL-diretos.';
END;
$$;
