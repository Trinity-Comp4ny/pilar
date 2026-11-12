-- Prévia de recursos (SPEC 160, modelo GitHub Feature preview): o ultra admin cadastra um recurso
-- em prévia e quem quiser liga para a própria conta em Configurações, com feedback e "voltar à
-- versão atual". O código do recurso pergunta usePrevia('<chave>') antes de mostrar a novidade.
--
-- recursos_previa: catálogo (todos leem os ativos; só ultra admin escreve).
-- usuario_previas: quem ligou o quê (cada um vê, liga e desliga os próprios; ultra admin lê).

CREATE TABLE IF NOT EXISTS public.recursos_previa (
  chave      text PRIMARY KEY CHECK (chave ~ '^[a-z][a-z0-9_-]{1,39}$'),
  nome       text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 80),
  descricao  text NOT NULL CHECK (length(trim(descricao)) BETWEEN 1 AND 400),
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recursos_previa IS 'Recursos em prévia que o usuário pode ligar (SPEC 160).';

CREATE TABLE IF NOT EXISTS public.usuario_previas (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chave     text NOT NULL REFERENCES public.recursos_previa(chave) ON DELETE CASCADE,
  ligado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_usuario_previas_chave ON public.usuario_previas (chave);

ALTER TABLE public.recursos_previa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_previas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recursos_previa FROM anon;
REVOKE ALL ON public.usuario_previas FROM anon;

DROP POLICY IF EXISTS "Previa select ativos" ON public.recursos_previa;
CREATE POLICY "Previa select ativos" ON public.recursos_previa
  FOR SELECT TO authenticated USING (ativo OR (SELECT public.is_ultra_admin()));
DROP POLICY IF EXISTS "Previa escrita ultra admin" ON public.recursos_previa;
CREATE POLICY "Previa escrita ultra admin" ON public.recursos_previa
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_ultra_admin()));
DROP POLICY IF EXISTS "Previa update ultra admin" ON public.recursos_previa;
CREATE POLICY "Previa update ultra admin" ON public.recursos_previa
  FOR UPDATE TO authenticated USING ((SELECT public.is_ultra_admin())) WITH CHECK ((SELECT public.is_ultra_admin()));

DROP POLICY IF EXISTS "Usuario previas select" ON public.usuario_previas;
CREATE POLICY "Usuario previas select" ON public.usuario_previas
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_ultra_admin()));
DROP POLICY IF EXISTS "Usuario previas insert own" ON public.usuario_previas;
CREATE POLICY "Usuario previas insert own" ON public.usuario_previas
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Usuario previas delete own" ON public.usuario_previas;
CREATE POLICY "Usuario previas delete own" ON public.usuario_previas
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
