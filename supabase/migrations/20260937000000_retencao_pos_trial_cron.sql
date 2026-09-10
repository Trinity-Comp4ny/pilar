-- SPEC 098 Fase 3: agenda o cron retencao-pos-trial (avisos dia 60/85,
-- exclusao dia 90). Mesmo padrao de segredo proprio via vault que
-- trial_expiry_disparar() (20260914000000_cron_secret_proprio.sql).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS retencao_aviso_60d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS retencao_aviso_85d_sent_at timestamptz;

COMMENT ON COLUMN public.empresas.retencao_aviso_60d_sent_at IS
  'SPEC 098 Fase 3: marca que o aviso de 60 dias em modo leitura ja foi enviado, evita reenvio pelo cron diario.';
COMMENT ON COLUMN public.empresas.retencao_aviso_85d_sent_at IS
  'SPEC 098 Fase 3: mesma finalidade de retencao_aviso_60d_sent_at, pro aviso de 85 dias (ultimo antes da exclusao no dia 90).';

CREATE OR REPLACE FUNCTION public.retencao_pos_trial_disparar()
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
    RAISE NOTICE 'retencao_pos_trial_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/retencao-pos-trial',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retencao_pos_trial_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retencao-pos-trial-daily') THEN
      PERFORM cron.unschedule('retencao-pos-trial-daily');
    END IF;
    -- 7h30, logo depois do trial-expiry-daily (7h00): dá tempo de uma
    -- empresa recem-expirada nao aparecer nas duas corridas no mesmo dia.
    PERFORM cron.schedule('retencao-pos-trial-daily', '30 7 * * *', 'SELECT public.retencao_pos_trial_disparar();');
  END IF;
END;
$$;
