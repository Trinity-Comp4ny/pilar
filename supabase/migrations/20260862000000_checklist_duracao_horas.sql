-- Spec 067: fluxo de disciplinas sem a camada "etapa". Itens de checklist
-- ganham duração (dias úteis) e horas estimadas, ambas opcionais e puramente
-- informativas nesta tabela: não alimentam data_previsao/status da disciplina
-- automaticamente (isso continua sendo regra do trigger existente, só sobre
-- `concluido`). A soma das durações vira a duração efetiva da disciplina no
-- fluxo — calculada no client (src/lib/fluxoCascata.ts), não no banco.

ALTER TABLE public.projeto_disciplina_checklist
  ADD COLUMN IF NOT EXISTS duracao_dias_uteis int,
  ADD COLUMN IF NOT EXISTS horas_estimadas numeric;

COMMENT ON COLUMN public.projeto_disciplina_checklist.duracao_dias_uteis IS
  'Dias úteis que este item consome (spec 067). Opcional; só alimenta o cálculo de prazo no momento em que o fluxo é aplicado, não recalcula depois.';
COMMENT ON COLUMN public.projeto_disciplina_checklist.horas_estimadas IS
  'Horas estimadas do item, opcional e só informativo (spec 067). Nunca soma em duracao_dias_uteis nem afeta data_previsao.';
