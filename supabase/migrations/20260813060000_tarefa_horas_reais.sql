-- Horas reais (gastas) por tarefa, ao lado das estimadas. Campo manual e leve,
-- preenchido direto na tarefa/linha. Independe do timesheet (que segue dormente)
-- e NÃO alimenta a rentabilidade por ora: é só o real vs estimado da tarefa.
alter table public.tarefas
  add column if not exists horas_reais numeric;

comment on column public.tarefas.horas_reais is
  'Horas efetivamente gastas na tarefa (manual, decimal: 1.5 = 1h30). Independe do timesheet.';
