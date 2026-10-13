-- SPEC 117: a triagem de feedback no portal ultra admin ganha o estado final
-- "resolvido" (bug corrigido, sugestão entregue). Antes só existia
-- "descartado" como fim de linha, e bug corrigido ficava preso em "planejado".

ALTER TABLE public.feature_suggestions
  DROP CONSTRAINT IF EXISTS feature_suggestions_status_interno_check;

ALTER TABLE public.feature_suggestions
  ADD CONSTRAINT feature_suggestions_status_interno_check
  CHECK (status_interno IN ('novo', 'em_analise', 'planejado', 'resolvido', 'descartado'));
