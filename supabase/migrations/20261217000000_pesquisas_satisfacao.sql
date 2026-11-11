-- Voz do cliente (SPEC 156): NPS (0 a 10) e pergunta rápida de esforço depois de um fluxo
-- (CES: 1 = foi fácil, 0 = não foi). Uma linha por resposta ou dispensa: dispensar conta para o
-- limite de frequência, que o app calcula pelas linhas do próprio usuário.
-- Detrator (NPS 0 a 6) avisa o ultra admin na hora (sino + e-mail, SPEC 113): a resposta vale
-- mais nas primeiras 48 h.

CREATE TABLE IF NOT EXISTS public.pesquisas_satisfacao (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       text NOT NULL CHECK (tipo IN ('nps', 'ces')),
  nota       smallint,
  dispensou  boolean NOT NULL DEFAULT false,
  comentario text CHECK (comentario IS NULL OR length(comentario) <= 1000),
  -- CES: qual fluxo foi avaliado (ex.: lancamento, proposta). NPS: nulo.
  fluxo      text CHECK (fluxo IS NULL OR fluxo ~ '^[a-z][a-z0-9_-]{0,39}$'),
  rota       text CHECK (rota IS NULL OR length(rota) <= 200),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pesquisas_nota_por_tipo CHECK (
    (dispensou AND nota IS NULL)
    OR (NOT dispensou AND tipo = 'nps' AND nota BETWEEN 0 AND 10)
    OR (NOT dispensou AND tipo = 'ces' AND nota IN (0, 1))
  ),
  CONSTRAINT pesquisas_fluxo_por_tipo CHECK ((tipo = 'ces') = (fluxo IS NOT NULL))
);

COMMENT ON TABLE public.pesquisas_satisfacao IS
  'Respostas de NPS e de esforço (CES) dentro do app (SPEC 156). Usuário vê só as próprias.';

CREATE INDEX IF NOT EXISTS idx_pesquisas_created_by_tipo ON public.pesquisas_satisfacao (created_by, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pesquisas_created_at ON public.pesquisas_satisfacao (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pesquisas_empresa_id ON public.pesquisas_satisfacao (empresa_id);

DROP TRIGGER IF EXISTS pesquisas_preenche_empresa ON public.pesquisas_satisfacao;
CREATE TRIGGER pesquisas_preenche_empresa
  BEFORE INSERT ON public.pesquisas_satisfacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_feedback_preenche_empresa();

ALTER TABLE public.pesquisas_satisfacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pesquisas_satisfacao FROM anon;

DROP POLICY IF EXISTS "Pesquisas insert own" ON public.pesquisas_satisfacao;
CREATE POLICY "Pesquisas insert own" ON public.pesquisas_satisfacao
  FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()));

-- Próprias (para o limite de frequência) e, para o ultra admin, todas.
DROP POLICY IF EXISTS "Pesquisas select own or ultra admin" ON public.pesquisas_satisfacao;
CREATE POLICY "Pesquisas select own or ultra admin" ON public.pesquisas_satisfacao
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (SELECT public.is_ultra_admin()));

-- Detrator avisa o ultra admin. Falha no aviso nunca derruba a resposta.
CREATE OR REPLACE FUNCTION public._pesquisa_avisar_detrator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa text;
BEGIN
  IF NEW.tipo <> 'nps' OR NEW.dispensou OR NEW.nota > 6 OR NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT e.nome INTO v_empresa FROM public.empresas e WHERE e.id = NEW.empresa_id;
  BEGIN
    PERFORM public.notificar_ultra_admins(
      NEW.empresa_id,
      'nps_detrator',
      format('NPS %s em %s', NEW.nota, coalesce(v_empresa, 'escritório sem nome')),
      coalesce(nullif(trim(NEW.comentario), ''), 'Sem comentário. Vale ligar em até 48 h.'),
      '/ultra-admin/satisfacao'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso de detrator falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._pesquisa_avisar_detrator() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pesquisas_avisar_detrator ON public.pesquisas_satisfacao;
CREATE TRIGGER pesquisas_avisar_detrator
  AFTER INSERT ON public.pesquisas_satisfacao
  FOR EACH ROW EXECUTE FUNCTION public._pesquisa_avisar_detrator();
