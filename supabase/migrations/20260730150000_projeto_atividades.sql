-- Spec 013 · Atividades no nível do projeto (painel lateral do modal, padrão ClickUp).
-- comentarios: [{id, texto, autor, data, mencionados}]  · links: [{url, rotulo}]
-- Herdam a RLS de projetos (escopo por empresa); são colunas da própria linha.

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS comentarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS links       jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projetos.comentarios IS 'Atividades do projeto [{id, texto, autor, data, mencionados}] (spec 013).';
COMMENT ON COLUMN public.projetos.links IS 'Links do projeto [{url, rotulo}] (spec 013).';
