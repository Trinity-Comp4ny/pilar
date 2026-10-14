-- SPEC 112: feedback (bug e sugestão) passa a gravar no banco, com print
-- anotado opcional, e avisa o ultra admin no sino. A tabela mantém o nome
-- legado feature_suggestions: o bundle antigo continua inserindo sugestão
-- (tipo cai no default) durante a janela de deploy.

-- ---------------------------------------------------------------------------
-- 1. Colunas novas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.feature_suggestions
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'sugestao'
    CHECK (tipo IN ('bug', 'sugestao')),
  ADD COLUMN IF NOT EXISTS print_path TEXT
    CHECK (print_path IS NULL OR length(print_path) <= 300),
  ADD COLUMN IF NOT EXISTS contexto JSONB
    CHECK (contexto IS NULL OR (jsonb_typeof(contexto) = 'object' AND pg_column_size(contexto) <= 4096)),
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sentry_event_id TEXT
    CHECK (sentry_event_id IS NULL OR length(sentry_event_id) <= 64);

-- Bug não tem título; sugestão continua exigindo (mesma regra de 20260851000000).
ALTER TABLE public.feature_suggestions ALTER COLUMN titulo DROP NOT NULL;
ALTER TABLE public.feature_suggestions DROP CONSTRAINT IF EXISTS feature_suggestions_titulo_check;
ALTER TABLE public.feature_suggestions DROP CONSTRAINT IF EXISTS feature_suggestions_titulo_por_tipo;
ALTER TABLE public.feature_suggestions ADD CONSTRAINT feature_suggestions_titulo_por_tipo CHECK (
  (titulo IS NULL OR length(titulo) <= 200)
  AND (tipo = 'bug' OR length(trim(coalesce(titulo, ''))) > 0)
);

-- Bug só com texto vazio não ajuda ninguém: a descrição passa a ser obrigatória.
ALTER TABLE public.feature_suggestions DROP CONSTRAINT IF EXISTS feature_suggestions_descricao_nao_vazia;
ALTER TABLE public.feature_suggestions ADD CONSTRAINT feature_suggestions_descricao_nao_vazia
  CHECK (length(trim(descricao)) > 0);

CREATE INDEX IF NOT EXISTS feature_suggestions_created_at_idx ON public.feature_suggestions(created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. empresa_id vem do perfil, nunca do client.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_feedback_preenche_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.empresa_id := (SELECT p.empresa_id FROM public.profiles p WHERE p.id = NEW.created_by);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_feedback_preenche_empresa() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS feedback_preenche_empresa ON public.feature_suggestions;
CREATE TRIGGER feedback_preenche_empresa
  BEFORE INSERT ON public.feature_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.tg_feedback_preenche_empresa();

-- ---------------------------------------------------------------------------
-- 3. Aviso no sino de todo ultra admin. Chama notificar() direto (não
--    notificar_ultra_admins) pra referenciar o próprio feedback: o dedup de
--    notificar() é por (tipo, referencia_id) não lido, e referenciar a empresa
--    engoliria o segundo feedback da mesma empresa. O e-mail sai do trigger
--    de notificacoes (SPEC 113, migration seguinte), igual aos outros avisos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_feedback_avisa_ultra_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_destinatarios uuid[];
  v_titulo        text;
BEGIN
  SELECT array_agg(p.id) INTO v_destinatarios
  FROM public.profiles p
  WHERE p.role = 'ultra_admin';

  v_titulo := CASE NEW.tipo
    WHEN 'bug' THEN 'Problema relatado'
    ELSE 'Sugestão: ' || left(NEW.titulo, 80)
  END;

  -- notificacoes.empresa_id é NOT NULL: feedback de quem não tem empresa
  -- (só um ultra admin sem empresa) fica só na aba Feedback.
  BEGIN
    IF NEW.empresa_id IS NOT NULL THEN
      PERFORM public.notificar(
        NEW.empresa_id, v_destinatarios, 'feedback_recebido', 'sistema', 'high',
        v_titulo, left(NEW.descricao, 200), 'feature_suggestions', NEW.id,
        '/ultra-admin?tab=feedback'
      );
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'tg_feedback_avisa_ultra_admins: falha ao notificar (%)', sqlerrm;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_feedback_avisa_ultra_admins() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS feedback_avisa_ultra_admins ON public.feature_suggestions;
CREATE TRIGGER feedback_avisa_ultra_admins
  AFTER INSERT ON public.feature_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.tg_feedback_avisa_ultra_admins();

-- ---------------------------------------------------------------------------
-- 4. INSERT: além de created_by, o print precisa estar na pasta do próprio
--    usuário (senão um feedback poderia apontar pro print de outra pessoa).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Feature Suggestions Insert Own" ON public.feature_suggestions;
CREATE POLICY "Feature Suggestions Insert Own" ON public.feature_suggestions
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (print_path IS NULL OR split_part(print_path, '/', 1) = (SELECT auth.uid())::text)
  );

-- ---------------------------------------------------------------------------
-- 5. Bucket privado dos prints. Path: {user_id}/{uuid}.{png|jpg|webp}.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-prints', 'feedback-prints', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Feedback print: ler" ON storage.objects;
DROP POLICY IF EXISTS "Feedback print: escrever" ON storage.objects;

-- SELECT do dono é necessário pro INSERT ... RETURNING do storage-api (ver
-- 20260883000000); ultra admin lê tudo pra triagem. Sem UPDATE/DELETE: print
-- enviado não muda.
CREATE POLICY "Feedback print: ler"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-prints'
    AND (split_part(name, '/', 1) = (SELECT auth.uid())::text OR public.is_ultra_admin())
  );

CREATE POLICY "Feedback print: escrever"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-prints'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );
