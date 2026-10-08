-- =============================================
-- Prontidão de produção (SPEC 104, achados de 08/10):
--
-- 1. Token do cartão (asaas_credit_card_token) deixa de ser legível por
--    qualquer membro da empresa. nivel_confianca() (INVOKER) passa a ler o
--    booleano gerado cartao_cadastrado. SELECT de authenticated vira grant
--    por coluna (todas menos o token); pgTAP garante que coluna nova não
--    nasce sem grant.
-- 2. sentry_cron_checkin() lê o DSN do Vault (app_sentry_dsn). O GUC
--    app.sentry_dsn exige ALTER DATABASE, bloqueado no Supabase gerenciado:
--    o monitor de cron do banco nunca funcionou em nenhum ambiente.
-- 3. Crons que existiam só à mão (renova-ciclo-tokens, em staging) ou em
--    nenhum lugar (reverificar-documentos-pendentes) passam a nascer por
--    migration, iguais nos dois ambientes.
-- 4. ops_saude_crons(): lista os secrets do Vault que faltam. O health usa
--    pra deixar visível o que hoje falha em silêncio (o job fica
--    "succeeded" no cron.job_run_details mesmo pulando o disparo).
-- =============================================

BEGIN;

-- 1. Token do cartão ------------------------------------------------------

ALTER TABLE public.pilar_subscriptions
  ADD COLUMN IF NOT EXISTS cartao_cadastrado boolean
  GENERATED ALWAYS AS (asaas_credit_card_token IS NOT NULL) STORED;

COMMENT ON COLUMN public.pilar_subscriptions.cartao_cadastrado IS
  'Há cartão tokenizado (Ativar plano). Versão legível do asaas_credit_card_token, que só service_role lê.';

CREATE OR REPLACE FUNCTION public.nivel_confianca(p_empresa_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT e.nivel_override FROM public.empresas e WHERE e.id = p_empresa_id),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.pilar_subscriptions s
        WHERE s.empresa_id = p_empresa_id
          AND s.cartao_cadastrado
      ) THEN 'ouro'
      WHEN EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = p_empresa_id
          AND e.cnpj IS NOT NULL
          AND e.documento_verificacao IN ('verificado', 'pendente', 'sem_verificacao_externa')
      ) THEN 'prata'
      ELSE 'bronze'
    END
  );
$function$;

-- anon nunca precisou ler assinatura; authenticated lê tudo menos o token.
REVOKE SELECT ON public.pilar_subscriptions FROM anon, authenticated;

DO $$
DECLARE
  v_colunas text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_colunas
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'pilar_subscriptions'
     AND column_name <> 'asaas_credit_card_token';
  EXECUTE format('GRANT SELECT (%s) ON public.pilar_subscriptions TO authenticated', v_colunas);
END;
$$;

-- 2. Monitor de cron do Sentry via Vault ---------------------------------

CREATE OR REPLACE FUNCTION public.sentry_cron_checkin(p_monitor_slug text, p_status text, p_check_in_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_dsn text;
  v_env text;
  v_match text[];
  v_check_in_id uuid := COALESCE(p_check_in_id, gen_random_uuid());
  v_url text;
BEGIN
  -- Vault primeiro (único caminho que funciona no Supabase gerenciado); o
  -- GUC fica só como fallback para quem já configurou em Postgres próprio.
  BEGIN
    v_dsn := COALESCE(NULLIF(public._cron_secret('app_sentry_dsn'), ''), current_setting('app.sentry_dsn', true));
    v_env := COALESCE(NULLIF(public._cron_secret('app_sentry_env'), ''), current_setting('app.sentry_env', true));
  EXCEPTION WHEN OTHERS THEN
    v_dsn := NULL;
  END;

  IF v_dsn IS NULL OR v_dsn = '' THEN
    RETURN v_check_in_id;
  END IF;

  -- DSN: https://<public_key>@<host>/<project_id>
  v_match := regexp_match(v_dsn, '^https://([^@]+)@([^/]+)/(.+)$');
  IF v_match IS NULL THEN
    RAISE WARNING 'sentry_cron_checkin: DSN em formato inesperado, check-in pulado';
    RETURN v_check_in_id;
  END IF;

  v_url := format(
    'https://%s/api/%s/cron/%s/%s/?status=%s&check_in_id=%s&environment=%s',
    v_match[2], v_match[3], p_monitor_slug, v_match[1], p_status, v_check_in_id,
    COALESCE(v_env, 'production')
  );

  -- Fire-and-forget: falha de rede aqui nunca derruba o job real.
  BEGIN
    PERFORM net.http_get(v_url);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sentry_cron_checkin: falha ao enviar check-in (%)', SQLERRM;
  END;

  RETURN v_check_in_id;
END;
$$;

COMMENT ON FUNCTION public.sentry_cron_checkin IS
  'Check-in HTTP no Sentry Crons para um pg_cron job. DSN e ambiente vêm do Vault (app_sentry_dsn, app_sentry_env). Ver ADR 0036.';

-- 3. Crons que faltavam ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverificar_documentos_disparar()
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
    RAISE NOTICE 'reverificar_documentos_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/reverificar-documentos-pendentes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverificar_documentos_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reverificar-documentos-daily') THEN
      PERFORM cron.unschedule('reverificar-documentos-daily');
    END IF;
    PERFORM cron.schedule('reverificar-documentos-daily', '45 6 * * *', 'SELECT public.reverificar_documentos_disparar();');

    -- Criado à mão em staging em set/2026; produção nunca teve. gate_tokens()
    -- abre o ciclo novo de cada empresa no dia 1, em vez de esperar o
    -- primeiro uso de IA do mês.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renova-ciclo-tokens') THEN
      PERFORM cron.unschedule('renova-ciclo-tokens');
    END IF;
    PERFORM cron.schedule('renova-ciclo-tokens', '5 3 1 * *', 'SELECT public.gate_tokens(id) FROM public.empresas WHERE deleted_at IS NULL');
  END IF;
END;
$$;

-- 4. Saúde da configuração dos crons --------------------------------------

CREATE OR REPLACE FUNCTION public.ops_saude_crons()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT jsonb_build_object(
    'secrets_faltando',
    COALESCE(
      (SELECT jsonb_agg(n ORDER BY n)
         FROM unnest(ARRAY['app_supabase_url', 'app_cron_secret']) AS n
        WHERE NULLIF(public._cron_secret(n), '') IS NULL),
      '[]'::jsonb
    ),
    'sentry_cron_configurado', NULLIF(public._cron_secret('app_sentry_dsn'), '') IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.ops_saude_crons() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_saude_crons() TO service_role;

COMMENT ON FUNCTION public.ops_saude_crons() IS
  'Secrets do Vault que os crons precisam e faltam neste ambiente. Lido pelo /health; nunca devolve valor de secret.';

COMMIT;
