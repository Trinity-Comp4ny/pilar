-- BEZ-33 / ADR 0062: retenção do áudio do registro de obra.
-- O texto e os campos extraídos ficam; o áudio some em 12 meses, quando a conta de campo que
-- gravou foi excluída, ou quando o registro (ou a obra/empresa, por cascata) deixou de existir.
-- O arquivo só pode sair pela API do Storage, então o banco só diz o que apagar
-- (registro_audio_para_apagar) e a edge registro-audio-limpar apaga e marca.

ALTER TABLE public.obra_registro ADD COLUMN IF NOT EXISTS audio_apagado_em timestamptz;

-- Um registro de áudio pode perder o arquivo sem deixar de ser de áudio.
DO $$
DECLARE
  v_nome text;
BEGIN
  FOR v_nome IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.obra_registro'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%audio_path IS NOT NULL%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.obra_registro DROP CONSTRAINT %I', v_nome);
  END LOOP;
END;
$$;

ALTER TABLE public.obra_registro DROP CONSTRAINT IF EXISTS obra_registro_audio_ck;
ALTER TABLE public.obra_registro ADD CONSTRAINT obra_registro_audio_ck
  CHECK (audio_path IS NOT NULL OR audio_apagado_em IS NOT NULL OR tipo <> 'audio');

-- Lista o que a edge deve apagar do Storage. Três motivos:
--   vencido        registro com mais de 12 meses
--   conta_removida registro de áudio cuja conta de campo foi excluída (autor sumiu)
--   orfao          objeto sem registro apontando para ele (registro, obra ou empresa excluídos);
--                  1 dia de folga porque o upload acontece antes do registro existir
CREATE OR REPLACE FUNCTION public.registro_audio_para_apagar(p_limite integer DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('path', x.path, 'registro_id', x.registro_id, 'motivo', x.motivo)), '[]'::jsonb)
  FROM (
    SELECT r.audio_path AS path, r.id AS registro_id,
           CASE WHEN r.data_registro < (current_date - interval '12 months') THEN 'vencido' ELSE 'conta_removida' END AS motivo
    FROM public.obra_registro r
    WHERE r.audio_path IS NOT NULL
      AND (
        r.data_registro < (current_date - interval '12 months')
        OR (r.autor_campo_account_id IS NULL AND r.autor_user_id IS NULL)
      )
    UNION ALL
    SELECT o.name AS path, NULL::uuid AS registro_id, 'orfao' AS motivo
    FROM storage.objects o
    WHERE o.bucket_id = 'obra-registro-audio'
      AND o.created_at < now() - interval '1 day'
      AND NOT EXISTS (SELECT 1 FROM public.obra_registro r WHERE r.audio_path = o.name)
    LIMIT GREATEST(COALESCE(p_limite, 200), 1)
  ) x;
$$;

REVOKE ALL ON FUNCTION public.registro_audio_para_apagar(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registro_audio_para_apagar(integer) TO service_role;

-- Disparo diário da edge, no mesmo molde dos outros crons (segredos no Vault, pg_net).
CREATE OR REPLACE FUNCTION public.registro_audio_limpar_disparar()
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
    RAISE NOTICE 'registro_audio_limpar_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/registro-audio-limpar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registro_audio_limpar_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'registro-audio-limpar-daily') THEN
      PERFORM cron.unschedule('registro-audio-limpar-daily');
    END IF;
    PERFORM cron.schedule('registro-audio-limpar-daily', '15 5 * * *', 'SELECT public.registro_audio_limpar_disparar();');
  END IF;
END;
$$;
