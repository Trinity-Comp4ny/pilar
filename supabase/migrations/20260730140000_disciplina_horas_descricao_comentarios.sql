-- Spec 013 · Disciplina no padrão ClickUp: horas reais, descrição e comentários.
-- horas_estimadas já existe. Adiciona:
--   horas_realizadas  — quanto realmente levou para concluir (par de horas_estimadas)
--   descricao         — texto livre de detalhamento da disciplina
--   comentarios       — atividades estruturadas [{id, texto, autor, data, mencionados}]
-- (a coluna `observacoes` legada, texto concatenado, fica para trás na UII nova.)

ALTER TABLE public.projeto_disciplinas
  ADD COLUMN IF NOT EXISTS horas_realizadas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descricao        text,
  ADD COLUMN IF NOT EXISTS comentarios      jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projeto_disciplinas.horas_realizadas IS 'Horas reais gastas (spec 013).';
COMMENT ON COLUMN public.projeto_disciplinas.descricao IS 'Descrição/detalhe da disciplina (spec 013).';
COMMENT ON COLUMN public.projeto_disciplinas.comentarios IS 'Atividades [{id, texto, autor, data, mencionados}] (spec 013).';
