-- =============================================
-- Crons disparados por pg_net esperam até 60s pela resposta da edge function.
--
-- O padrão do net.http_post é 5s. Edge que chama o Asaas (trial-expiry-cron
-- convertendo trial em assinatura) passa disso: em 09/10 a primeira cobrança
-- automática real foi feita, mas net._http_response registrou "Timeout of
-- 5000 ms reached" em vez da resposta. A função terminou mesmo assim, só que
-- o resultado real não ficava registrado. Corpo das funções idêntico ao
-- anterior; muda só o timeout.
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trial_expiry_disparar()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_cron_secret');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'trial_expiry_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/trial-expiry-cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.notificacoes_email_disparar(p_modo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF p_modo NOT IN ('imediato', 'semanal') THEN
    RAISE EXCEPTION 'modo inválido: %', p_modo;
  END IF;

  v_url := public._cron_secret('app_supabase_url');
  v_key := public._cron_secret('app_cron_secret');

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'notificacoes_email_disparar: vault secrets app_supabase_url/app_cron_secret ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notificacoes-email-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('modo', p_modo),
    timeout_milliseconds := 60000
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.guardiao_margem_disparar()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_cron_secret');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'guardiao_margem_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/guardiao-margem-cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.retencao_pos_trial_disparar()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_cron_secret');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'retencao_pos_trial_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/retencao-pos-trial',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverificar_documentos_disparar()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_cron_secret');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'reverificar_documentos_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/reverificar-documentos-pendentes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;

COMMIT;
