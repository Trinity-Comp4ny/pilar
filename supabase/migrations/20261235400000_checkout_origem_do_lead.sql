-- Origem do cliente que assina pelo checkout: a landing repassa canal e UTMs no
-- link do plano, o checkout grava em pilar_pending_signups e, quando a empresa
-- nasce (handle_new_user, depois do pagamento), empresas.origem é preenchida.
--
-- Antes disso, os cadastros novos entravam por convite/checkout e a origem se
-- perdia: empresas.origem ficava vazia nas 13 empresas (consulta de 25/11).
-- Só preenche quando empresas.origem está vazia: o ultra-admin, que edita à mão,
-- sempre vence. Sem dado pessoal: canal e parâmetros de campanha.

BEGIN;

ALTER TABLE public.pilar_pending_signups
  ADD COLUMN IF NOT EXISTS canal text,
  ADD COLUMN IF NOT EXISTS origem jsonb;

ALTER TABLE public.pilar_pending_signups
  ADD CONSTRAINT pilar_pending_signups_canal_tamanho CHECK (canal IS NULL OR char_length(canal) <= 40),
  ADD CONSTRAINT pilar_pending_signups_origem_tamanho CHECK (origem IS NULL OR pg_column_size(origem) <= 4000);

COMMENT ON COLUMN public.pilar_pending_signups.canal IS
  'Canal de aquisição classificado na landing (google, chatgpt, linkedin, meta_ads, direto...). Informado pelo cliente: serve a análise, não a cobrança.';
COMMENT ON COLUMN public.pilar_pending_signups.origem IS
  'UTMs, gclid/fbclid e ref do primeiro toque, repassados pela landing ao checkout.';

-- Canal da landing -> valor do enum empresas.origem. "direto" não diz nada: fica nulo.
CREATE OR REPLACE FUNCTION public.empresas_origem_do_canal(p_canal text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE lower(coalesce(p_canal, ''))
    WHEN '' THEN NULL
    WHEN 'direto' THEN NULL
    WHEN 'google' THEN 'google'
    WHEN 'google_ads' THEN 'google'
    WHEN 'chatgpt' THEN 'ia'
    WHEN 'perplexity' THEN 'ia'
    WHEN 'gemini' THEN 'ia'
    WHEN 'claude' THEN 'ia'
    WHEN 'copilot' THEN 'ia'
    WHEN 'linkedin' THEN 'linkedin'
    WHEN 'instagram' THEN 'instagram'
    WHEN 'youtube' THEN 'youtube'
    ELSE 'outro'
  END
$$;

REVOKE ALL ON FUNCTION public.empresas_origem_do_canal(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.empresas_preencher_origem_do_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_canal text;
BEGIN
  IF NEW.origem IS NOT NULL OR NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ps.canal
    INTO v_canal
    FROM public.pilar_pending_signups ps
    JOIN auth.users u ON lower(u.email) = lower(ps.email)
   WHERE u.id = NEW.owner_id
     AND ps.canal IS NOT NULL
   ORDER BY ps.created_at DESC
   LIMIT 1;

  NEW.origem := public.empresas_origem_do_canal(v_canal);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.empresas_preencher_origem_do_checkout() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS empresas_origem_do_checkout ON public.empresas;
CREATE TRIGGER empresas_origem_do_checkout
  BEFORE INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.empresas_preencher_origem_do_checkout();

COMMIT;
