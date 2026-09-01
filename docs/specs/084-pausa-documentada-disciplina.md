# SPEC: Pausa documentada por disciplina (dias parados como registro auditável)

**Data:** 2026-09-01
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos

<!-- Origem: reunião com Rafael (Mawe Arquitetura, design partner) em 2026-09-01. -->

## Problema

O cronograma por disciplina (`projeto_disciplinas`) já tem prazo em dias por etapa. O
que falta, levantado pelo Rafael, é contabilizar **dias parados/travados** como registro
documentado, não só um texto livre de atraso. Hoje o único campo próximo é
`justificativa_atraso` (texto único, sem histórico, sem data de início/fim do evento) —
não dá pra provar pro cliente "parou 3 dias porque você não confirmou X", porque não
existe um histórico auditável de quando parou, por quê, e quando voltou.

## Objetivo

Cada pausa de disciplina vira um registro com motivo obrigatório, quem pausou/retomou e
quando. A disciplina ganha um status "Pausada" só alcançável por esse fluxo (não por
edição livre de status), e a tela mostra o histórico completo + total de dias parados.

## Fora de escopo (fast-follow)

- Excluir os dias parados da conta de atraso (`isDiscAtrasada`/`getDiscDeadlineStatus`).
- Relatório PDF de pausa (Rafael ainda vai mandar o desenho dele pra comparar antes).
- Indicador visual de pausa na barra do Gantt (`CronogramaTab.tsx`/`CronogramaProjetosTab.tsx`).
- Pausa em tarefa de obra (`ObraCronogramaTab.tsx` usa outro modelo de dado).

## Design

**Tabela** `projeto_disciplina_pausas`: histórico append-only por disciplina (`motivo`,
`pausado_em`/`pausado_por`, `retomado_em`/`retomado_por` nulável enquanto aberta). RLS via
join até `projetos.empresa_id`, mesmo padrão de `projeto_disciplina_checklist`
(`supabase/migrations/20260853000000_projeto_disciplina_checklist.sql`). Índice único
parcial garante no máximo 1 pausa aberta por disciplina.

**RPCs** `rpc_pausar_disciplina(disciplina_id, motivo)` / `rpc_retomar_disciplina(disciplina_id)`:
atômicas (inserem/fecham o registro de pausa E mudam `projeto_disciplinas.status` juntos),
com check explícito de tenant no corpo da função (`SECURITY DEFINER` roda como dono da
tabela, então bypassa RLS — o check tem que ser manual). Sem INSERT/UPDATE direto do client
na tabela de pausas: só via essas RPCs, pra motivo e timestamps nunca ficarem inconsistentes.

**Status novo** `"Pausada"` em `disciplinaStatusOptions`. Exibido no Select da disciplina
mas como opção desabilitada (não dá pra setar status "Pausada" nem sair dela editando o
campo direto) — só entra/sai por Pausar/Retomar.

**UI** (`DisciplinaDetailDialog.tsx`): botão Pausar (abre motivo obrigatório num
`FormDialog` `sm`) quando status é "Em Andamento"; botão Retomar quando "Pausada" (sem
motivo, ação direta). Lista de histórico (motivo, quem, duração) + total de dias parados
somado no client.

## Achado de segurança (não corrigido aqui, fora de escopo)

`recalc_disciplina_status_por_checklist` (`20260853000000`) é `SECURITY DEFINER` +
`GRANT ... TO authenticated` sem check de tenant no corpo — como roda como dono da tabela,
bypassa RLS. As RPCs desta spec têm o check; a função existente fica como débito a corrigir
num follow-up de segurança separado.
