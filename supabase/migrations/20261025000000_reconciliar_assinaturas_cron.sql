-- SPEC 114: agenda a reconciliação diária das assinaturas com o Asaas.
-- Mesmo padrão dos outros crons (retencao_pos_trial_disparar, 20260937000000):
-- segredos no Vault, pg_net com timeout de 60s (20261017000000), função sem EXECUTE
-- para ninguém além do dono.

CREATE OR REPLACE FUNCTION public.reconciliar_assinaturas_disparar()
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
    RAISE NOTICE 'reconciliar_assinaturas_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/reconciliar-assinaturas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconciliar_assinaturas_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconciliar-assinaturas-daily') THEN
      PERFORM cron.unschedule('reconciliar-assinaturas-daily');
    END IF;
    -- 6h30 (UTC), antes do trial-expiry-daily (7h): a rodada olha o estado da noite.
    PERFORM cron.schedule('reconciliar-assinaturas-daily', '30 6 * * *', 'SELECT public.reconciliar_assinaturas_disparar();');
  END IF;
END;
$$;
