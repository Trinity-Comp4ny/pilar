-- SPEC 135, fase C (BEZ-57): resumo da semana que o cliente vê no portal.
-- Guarda o último resumo gerado por obra. `fonte_hash` identifica exatamente os registros
-- liberados que ele cobre: se o gestor liberar, tirar ou corrigir um registro, o hash muda e a
-- edge portal-resumo-semana refaz o resumo; se nada mudou, o texto guardado vale e a IA não é
-- chamada de novo.
--
-- Só a edge (service role) lê e grava. RLS ligada, sem policy e sem grant para anon e
-- authenticated: proteção por ausência de regra E por revogação (supabase/tests/hardening_grants_search_path.sql).

CREATE TABLE IF NOT EXISTS public.obra_resumo_semana (
  obra_id     uuid PRIMARY KEY REFERENCES public.obras(id) ON DELETE CASCADE,
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fonte_hash  text NOT NULL,
  texto       text NOT NULL CHECK (length(texto) BETWEEN 1 AND 600),
  gerado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_resumo_semana_empresa ON public.obra_resumo_semana (empresa_id);

ALTER TABLE public.obra_resumo_semana ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.obra_resumo_semana FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.obra_resumo_semana TO service_role;
