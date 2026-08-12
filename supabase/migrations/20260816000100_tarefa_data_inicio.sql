-- Cronograma da obra em dois níveis (spec 027): o passo (tarefa) ganha uma data
-- de início prevista para virar barra no Gantt, com o `prazo` existente fazendo
-- as vezes de fim. Opcional: tarefas já existentes (inclusive as de "Meu
-- trabalho") nascem sem data_inicio e seguem funcionando normalmente.
-- RLS inalterada: as policies existentes de `tarefas` já cobrem esta coluna.

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS data_inicio date;

-- Coerência: quando ambos existem, o início não pode ser depois do prazo (fim).
ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefa_datas_coerentes;
ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefa_datas_coerentes
  CHECK (data_inicio IS NULL OR prazo IS NULL OR prazo >= data_inicio);
