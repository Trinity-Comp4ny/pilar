-- ============================================================================
-- Três crons (trial-expiry-daily, guardiao-margem-daily, notificacoes-email-*)
-- dependiam de `current_setting('app.supabase_url')` / `app.service_role_key`,
-- configuráveis só via `ALTER DATABASE postgres SET ...`. Essa operação exige
-- superuser, que o Supabase gerenciado não concede nem no SQL Editor nem por
-- `psql` direto: é bloqueio de privilégio do papel `postgres` no projeto, não
-- do usuário da conta. Nenhum dos três cron jobs rodou com sucesso até hoje,
-- confirmado pelo erro `permission denied to set parameter` ao tentar aplicar
-- o pré-requisito documentado nas migrations originais.
--
-- Dois dos três (trial-expiry-daily, guardiao-margem-daily) usavam
-- `current_setting()` sem o segundo argumento (missing_ok): sem o setting, a
-- própria chamada lança erro, e o job aparece como falhado em
-- cron.job_run_details a cada execução, desde que foram criados.
--
-- Fix: ler as duas credenciais do Supabase Vault (`vault.decrypted_secrets`),
-- que é o caminho oficial do Supabase gerenciado para segredo usado dentro de
-- uma função Postgres, já em uso neste repo por
-- `notify_data_deletion_request()` (20260511000000). Vault se popula com um
-- SELECT comum, não uma ALTER DATABASE, então não esbarra no mesmo bloqueio.
--
-- Pré-requisito (rodar uma vez no SQL Editor de cada ambiente, staging e prod;
-- substituir <ref> e <service_role_key>, este último sensível, nunca commitar):
--   SELECT vault.create_secret('https://<ref>.supabase.co', 'app_supabase_url', 'URL do próprio projeto, para os cron jobs chamarem suas edge functions');
--   SELECT vault.create_secret('<service_role_key>', 'app_service_role_key', 'Service role key, para os cron jobs autenticarem nas edge functions');
--
-- Nomes deliberadamente distintos dos secrets 'supabase_url'/
-- 'data_deletion_notify_secret' de 20260511000000 (concern diferente, evita
-- acoplar duas features por um vault secret compartilhado).
-- ============================================================================

CREATE OR REPLACE FUNCTION public._cron_secret(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name ORDER BY created_at DESC LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._cron_secret(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public._cron_secret(text) IS
  'Lê um secret do Supabase Vault para uso em cron job (pg_net). NULL se ausente, nunca lança. Só o dono da função (postgres/service role) chama.';

-- ---------------------------------------------------------------------------
-- notificacoes_email_disparar: troca current_setting() por _cron_secret(),
-- mantendo o mesmo guard-and-NOTICE de antes (comportamento de fail-closed
-- silencioso preservado, só a fonte do dado muda).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notificacoes_email_disparar(p_modo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF p_modo NOT IN ('imediato', 'semanal') THEN
    RAISE EXCEPTION 'modo inválido: %', p_modo;
  END IF;

  v_url := public._cron_secret('app_supabase_url');
  v_key := public._cron_secret('app_service_role_key');

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'notificacoes_email_disparar: vault secrets app_supabase_url/app_service_role_key ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notificacoes-email-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('modo', p_modo)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_email_disparar(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- trial-expiry-daily: mesma troca, agora com guard (antes lançava e o job
-- aparecia como falhado a cada execução quando o GUC estava ausente).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trial_expiry_disparar()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_service_role_key');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'trial_expiry_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/trial-expiry-cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trial_expiry_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-expiry-daily') THEN
      PERFORM cron.unschedule('trial-expiry-daily');
    END IF;
    PERFORM cron.schedule('trial-expiry-daily', '0 7 * * *', 'SELECT public.trial_expiry_disparar();');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- guardiao-margem-daily: mesma troca.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guardiao_margem_disparar()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_service_role_key');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'guardiao_margem_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/guardiao-margem-cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardiao_margem_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'guardiao-margem-daily') THEN
      PERFORM cron.unschedule('guardiao-margem-daily');
    END IF;
    PERFORM cron.schedule('guardiao-margem-daily', '15 6 * * *', 'SELECT public.guardiao_margem_disparar();');
  END IF;
END;
$$;
