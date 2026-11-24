-- SPEC 172 fase 2: enriquecimento por CNPJ (decisor pelo quadro societário, segmento por CNAE).
--
-- O CNPJ entra pela importação (coluna "CNPJ"). A edge function prospeccao-enriquecer consulta a
-- BrasilAPI (dado público, sem custo) em lotes pequenos e grava por prospec_registrar_enriquecimento
-- (service role). Nenhuma consulta por nome: a BrasilAPI só busca por número de CNPJ.

ALTER TABLE public.prospec_leads
  ADD COLUMN IF NOT EXISTS cnpj text CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS cnae_principal text,
  ADD COLUMN IF NOT EXISTS enriquecido_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS prospec_leads_cnpj_uidx ON public.prospec_leads (cnpj)
  WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospec_leads_enriquecer_idx ON public.prospec_leads (created_at)
  WHERE cnpj IS NOT NULL AND enriquecido_em IS NULL;

-- Lote de leads com CNPJ ainda não consultado. Só o service role chama.
CREATE OR REPLACE FUNCTION public.prospec_leads_para_enriquecer(p_limite integer DEFAULT 20)
RETURNS TABLE (id uuid, cnpj text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.cnpj FROM public.prospec_leads l
   WHERE l.cnpj IS NOT NULL AND l.enriquecido_em IS NULL
   ORDER BY l.created_at
   LIMIT least(greatest(coalesce(p_limite, 20), 1), 100);
$$;
REVOKE ALL ON FUNCTION public.prospec_leads_para_enriquecer(integer) FROM PUBLIC, anon, authenticated;

-- Grava o resultado da consulta. Decisor informado vira contato_nome (lead passa a `pessoa` só
-- quando o telefone é celular). p_ajuste_nota soma à nota de encaixe (CNAE compatível ou não).
CREATE OR REPLACE FUNCTION public.prospec_registrar_enriquecimento(
  p_lead uuid,
  p_razao_social text,
  p_cnae text,
  p_decisor text,
  p_ajuste_nota integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decisor text := nullif(btrim(p_decisor), '');
BEGIN
  UPDATE public.prospec_leads SET
    razao_social = nullif(btrim(p_razao_social), ''),
    cnae_principal = nullif(btrim(p_cnae), ''),
    enriquecido_em = now(),
    contato_nome = coalesce(contato_nome, v_decisor),
    confianca_contato = CASE WHEN v_decisor IS NOT NULL AND tipo_telefone = 'celular'
                             THEN 'pessoa' ELSE confianca_contato END,
    nota_encaixe = least(100, greatest(0, nota_encaixe + coalesce(p_ajuste_nota, 0)))
  WHERE id = p_lead;
END;
$$;
REVOKE ALL ON FUNCTION public.prospec_registrar_enriquecimento(uuid, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;

-- Cron diário 06h BRT (09:00 UTC).
CREATE OR REPLACE FUNCTION public.prospec_enriquecedor_disparar()
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
    RAISE NOTICE 'prospec_enriquecedor_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/prospeccao-enriquecer',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
END;
$$;
REVOKE ALL ON FUNCTION public.prospec_enriquecedor_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prospeccao-enriquecer-diario') THEN
      PERFORM cron.unschedule('prospeccao-enriquecer-diario');
    END IF;
    PERFORM cron.schedule('prospeccao-enriquecer-diario', '0 9 * * *', 'SELECT public.prospec_enriquecedor_disparar()');
  END IF;
END;
$$;
