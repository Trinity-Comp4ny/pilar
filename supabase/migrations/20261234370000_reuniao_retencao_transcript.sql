-- SPEC 169: retenção do transcript. Os pontos da reunião (insights, compromissos, segmentos)
-- ficam sem prazo; o texto redigido da transcrição é apagado 12 meses depois da criação.
-- A reunião e a análise continuam: só `transcript_redigido` vira NULL. Nenhuma tela lê essa coluna.

CREATE OR REPLACE FUNCTION public.limpar_transcricoes_reuniao()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limpos integer;
BEGIN
  UPDATE public.reuniao
  SET transcript_redigido = NULL
  WHERE transcript_redigido IS NOT NULL
    AND created_at < now() - interval '12 months';
  GET DIAGNOSTICS v_limpos = ROW_COUNT;
  RETURN v_limpos;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_transcricoes_reuniao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_transcricoes_reuniao() TO service_role;

COMMENT ON FUNCTION public.limpar_transcricoes_reuniao() IS
  'SPEC 169: zera transcript_redigido de reuniões com mais de 12 meses. Mantém os pontos da análise.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpar-transcricoes-reuniao-daily') THEN
      PERFORM cron.unschedule('limpar-transcricoes-reuniao-daily');
    END IF;
    PERFORM cron.schedule('limpar-transcricoes-reuniao-daily', '50 4 * * *', 'SELECT public.limpar_transcricoes_reuniao();');
  END IF;
END;
$$;
