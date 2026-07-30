-- Spec 013 · Acabamento da unidade de trabalho (Frente B, onda 1)
-- Labels e links na disciplina e na tarefa; comentários estruturados na tarefa
-- (a disciplina já tem observações). Sem storage aqui — anexos vêm na onda 2.
--
-- Herdam a RLS das tabelas donas (projeto_disciplinas: policy FOR ALL por empresa;
-- tarefas: policies por empresa da migration 20260730000100). Nenhuma policy nova:
-- são colunas da mesma linha, o escopo por empresa já cobre.

-- Disciplina -------------------------------------------------------------------
ALTER TABLE public.projeto_disciplinas
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS links  jsonb  NOT NULL DEFAULT '[]'::jsonb;

-- Tarefa avulsa ----------------------------------------------------------------
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS labels      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS links       jsonb  NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comentarios jsonb  NOT NULL DEFAULT '[]'::jsonb;

-- Formas esperadas (validadas na aplicação, jsonb livre no banco):
--   links       = [{ "url": text, "rotulo": text }]
--   comentarios = [{ "id": text, "texto": text, "autor": text, "data": timestamptz }]

COMMENT ON COLUMN public.projeto_disciplinas.labels IS 'Etiquetas curtas (spec 013).';
COMMENT ON COLUMN public.projeto_disciplinas.links  IS 'Links [{url, rotulo}] (spec 013).';
COMMENT ON COLUMN public.tarefas.labels      IS 'Etiquetas curtas (spec 013).';
COMMENT ON COLUMN public.tarefas.links       IS 'Links [{url, rotulo}] (spec 013).';
COMMENT ON COLUMN public.tarefas.comentarios IS 'Comentários [{id, texto, autor, data}] (spec 013).';
