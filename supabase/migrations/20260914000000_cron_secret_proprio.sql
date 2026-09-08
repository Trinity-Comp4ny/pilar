-- ============================================================================
-- 20260913000000 tirou as credenciais dos crons de `ALTER DATABASE` pro
-- Supabase Vault, usando `app_service_role_key`. Ao testar em staging (08/09),
-- todo cron continuou voltando 401: o `SUPABASE_SERVICE_ROLE_KEY` que a
-- Supabase injeta automaticamente em toda edge function TROCOU de formato
-- (era um JWT longo, agora é uma chave curta `sb_secret_...`) sem aviso nem
-- mudança de nome da variável, então a chave que aparece na tela de API Keys
-- do dashboard não é mais o que a function realmente recebe. Confirmado
-- comparando o hash de um e do outro numa function de diagnóstico descartável.
--
-- Fix: os três crons (trial-expiry-daily, guardiao-margem-daily,
-- notificacoes-email-*) passam a verificar um segredo PRÓPRIO, `CRON_SECRET`,
-- independente de qualquer formato de chave que a Supabase decida usar. O
-- `SUPABASE_SERVICE_ROLE_KEY` continua sendo usado para as chamadas normais ao
-- banco dentro de cada function (isso nunca quebrou); só a verificação de
-- quem está chamando o endpoint é que muda de credencial.
--
-- Pré-requisito, uma vez por ambiente: gerar um valor aleatório
-- (`openssl rand -hex 32`) e gravar nos dois lados com O MESMO valor:
--   supabase secrets set CRON_SECRET='<valor>' --project-ref <ref>
--   SELECT vault.create_secret('<valor>', 'app_cron_secret', 'Segredo compartilhado só entre os cron jobs e as edge functions de cron');
-- ============================================================================

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
    body    := jsonb_build_object('modo', p_modo)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_email_disparar(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trial_expiry_disparar()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
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
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trial_expiry_disparar() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guardiao_margem_disparar()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
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
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardiao_margem_disparar() FROM PUBLIC, anon, authenticated;
