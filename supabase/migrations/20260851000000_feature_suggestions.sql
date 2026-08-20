-- Spec 056: feedback do usuário via modal único (bug vai pro Sentry via
-- sendFeedback; sugestão de feature cai aqui). Sem board público, sem voto,
-- sem histórico pro usuário: só o ultra admin lê, em /ultra-admin.

CREATE TABLE IF NOT EXISTS public.feature_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL CHECK (length(trim(titulo)) > 0 AND length(titulo) <= 200),
  descricao TEXT NOT NULL CHECK (length(descricao) <= 5000),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status_interno TEXT NOT NULL DEFAULT 'novo'
    CHECK (status_interno IN ('novo', 'em_analise', 'planejado', 'descartado'))
);

CREATE INDEX IF NOT EXISTS feature_suggestions_created_by_idx ON public.feature_suggestions(created_by);

ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

-- Só o ultra admin lê: não existe board nem lista pro usuário comum, então
-- SELECT amplo pra authenticated não tem uso e só aumenta a superfície.
DROP POLICY IF EXISTS "Feature Suggestions Select Ultra Admin" ON public.feature_suggestions;
CREATE POLICY "Feature Suggestions Select Ultra Admin" ON public.feature_suggestions
  FOR SELECT TO authenticated USING (public.is_ultra_admin());

DROP POLICY IF EXISTS "Feature Suggestions Insert Own" ON public.feature_suggestions;
CREATE POLICY "Feature Suggestions Insert Own" ON public.feature_suggestions
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Feature Suggestions Update Ultra Admin" ON public.feature_suggestions;
CREATE POLICY "Feature Suggestions Update Ultra Admin" ON public.feature_suggestions
  FOR UPDATE TO authenticated USING (public.is_ultra_admin()) WITH CHECK (public.is_ultra_admin());
