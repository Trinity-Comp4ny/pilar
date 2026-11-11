-- Lacunas da central de ajuda (SPEC 155): pergunta que o agente da ajuda não resolveu, ou busca
-- da central sem resultado, vira pauta de artigo novo. O usuário só grava a própria pergunta; só
-- o ultra admin lê. empresa_id vem do perfil por trigger (mesmo padrão do feedback, SPEC 112),
-- nunca do cliente.

CREATE TABLE IF NOT EXISTS public.ajuda_perguntas_sem_resposta (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto      text NOT NULL CHECK (length(trim(texto)) BETWEEN 2 AND 300),
  rota       text CHECK (rota IS NULL OR length(rota) <= 200),
  origem     text NOT NULL CHECK (origem IN ('agente', 'central')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ajuda_perguntas_sem_resposta IS
  'Perguntas sem resposta na ajuda: pauta de artigos novos (SPEC 155). Só o ultra admin lê.';

CREATE INDEX IF NOT EXISTS idx_ajuda_perguntas_created_at ON public.ajuda_perguntas_sem_resposta (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ajuda_perguntas_created_by ON public.ajuda_perguntas_sem_resposta (created_by);
CREATE INDEX IF NOT EXISTS idx_ajuda_perguntas_empresa_id ON public.ajuda_perguntas_sem_resposta (empresa_id);

DROP TRIGGER IF EXISTS ajuda_perguntas_preenche_empresa ON public.ajuda_perguntas_sem_resposta;
CREATE TRIGGER ajuda_perguntas_preenche_empresa
  BEFORE INSERT ON public.ajuda_perguntas_sem_resposta
  FOR EACH ROW EXECUTE FUNCTION public.tg_feedback_preenche_empresa();

ALTER TABLE public.ajuda_perguntas_sem_resposta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ajuda_perguntas_sem_resposta FROM anon;

DROP POLICY IF EXISTS "Ajuda perguntas insert own" ON public.ajuda_perguntas_sem_resposta;
CREATE POLICY "Ajuda perguntas insert own" ON public.ajuda_perguntas_sem_resposta
  FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Ajuda perguntas select ultra admin" ON public.ajuda_perguntas_sem_resposta;
CREATE POLICY "Ajuda perguntas select ultra admin" ON public.ajuda_perguntas_sem_resposta
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
