# SPEC: Board unificado de "Meu trabalho"

**Data:** 2026-07-30
**Status:** Fase 1 implementada (branch de trabalho); Fases 2-3 pendentes
**Autor:** Matheus Rezende
**Módulo:** gestao / meu-trabalho

## Problema

A primeira versão de "Meu trabalho" (spec 008) entregou três abas separadas
(Minhas disciplinas, Tarefas, Agenda) com listas verticais agrupadas fixamente em
A fazer / Fazendo / Concluído. O CEO achou "muito simples, engessado e feio":
quer o padrão de apresentação do ClickUp/Trello, mais densidade de informação, e
poder ver tudo num lugar só, filtrando o que olhar.

## Decisões (calibradas com o CEO em 2026-07-30)

1. **Board com agrupamento flexível**, não listas fixas por status. O usuário
   escolhe agrupar por status, projeto, responsável ou prioridade. Colunas de
   status/prioridade são fixas (não é board configurável estilo Monday, que o
   painel recusou na spec 013); as de projeto/responsável são dinâmicas.
2. **Visão unificada, modelo não achatado.** Tarefas avulsas e disciplinas de
   projeto aparecem no mesmo board, com um filtro de tipo (Tudo/Tarefas/
   Disciplinas). Por baixo continuam entidades separadas (`tarefas` e
   `projeto_disciplinas`): o item carrega seu `tipo` e a origem. Não fere a
   recusa unânime de achatar o modelo (spec 013).
3. **Status e prioridade inline no card** (dropdown, sem abrir o item). Disciplina
   muda status (RPC `set_disciplina_status`); prioridade da disciplina é leitura
   (mora no projeto). Tarefa muda os dois.
4. **Horas estimadas reabertas por decisão explícita do CEO**, ciente de que o
   painel (spec 013, "Fora de escopo") as travara até a captura de horas (gate 2).
   Campo opcional na tarefa, sem cálculo de margem — não toca `useRentabilidade`.
   Registro da reabertura fica aqui e na memória, com o gatilho original anotado.
5. **Agenda vira um modo** ("Quadro | Agenda") dentro da mesma tela, não uma aba
   irmã.

## Escopo por fase

**Fase 1 — Fundação + board (implementada):**

- Migration `20260730000400`: `tarefas.prioridade` (alta/media/baixa) e
  `tarefas.horas_estimadas`; RPC `get_minhas_disciplinas` estendida com
  prioridade, responsável e o acabamento (labels/links) da spec 013.
- `useItensTrabalho`: funde tarefa + disciplina em `ItemTrabalho`; `agruparItens`
  monta as colunas por critério.
- `QuadroTrabalho` + `CardTrabalho`: board horizontal, card rico (prioridade,
  responsável, prazo com destaque de atraso, projeto, etiquetas, contadores de
  comentário/link), status/prioridade inline, menu de editar/excluir.
- `index` reescrito: toolbar (visão, agrupar por, tipo), busca, filtro de pessoa
  (só admin), dialog de tarefa. Abas antigas (`AbaTarefas`, `AbaProjetos`,
  `GrupoStatus`) removidas.
- `TarefaDialog` ganhou os campos prioridade e horas (o resto — etiquetas, links,
  anexos, comentários — já veio da spec 013).

**Fase 2 — Modal no padrão ClickUp (pendente):** reestilizar o `TarefaDialog` em
duas colunas (conteúdo à esquerda, metadados à direita), em vez da barra vertical
atual. Botão de excluir dentro do modal. Sem novo dado.

**Fase 3 — Agenda-calendário (pendente):** a Agenda como visão de calendário de
verdade.

**Drag-and-drop + colunas personalizáveis (implementado):** o board reusa o padrão
Kanban de Projetos (`@hello-pangea/dnd`), mas generalizado — arrastar um card seta o
campo pelo qual o board está agrupado (status, prioridade, projeto, responsável),
com update otimista. Disciplina só aceita drop de status (o resto é só-leitura nela).

Colunas de status personalizáveis (decisão do CEO em 2026-07-30, reabrindo o board
configurável que a spec 013 travara). O board é **sempre** um Kanban de status: as
colunas são as "etapas" (não há mais "Agrupar por"). As 3 âncoras (A fazer / Em
andamento / Concluído) têm um `bucket` (a_fazer/fazendo/concluida) e **não podem ser
excluídas** — são o status coarse e o ponto onde as disciplinas (que só conhecem os
3 baldes) se encaixam. Colunas extras (ex.: "Bloqueado") têm bucket nulo e valem só
para tarefa; podem ser criadas, renomeadas, reordenadas e excluídas (excluir devolve
as tarefas para "A fazer", `ON DELETE SET NULL`). Disciplinas continuam visíveis no
board, posicionadas pela âncora do seu bucket; arrastar disciplina só entra em
âncora. Tabelas: `tarefa_etapas` (migration `20260730000500`) + coluna `bucket`
(`20260730000600`). Qualquer membro da empresa gerencia as colunas.

Filtros e autoria: filtro de **data** (atrasadas / hoje / 7 dias / sem prazo) para
todos; filtro de **pessoa** só para admin (não-admin vê apenas o próprio trabalho,
via RLS + query). Criar tarefa **já atribui a quem cria**, com o campo de
responsável travado para não-admin (só admin reatribui).

## Verificação

- `npm run typecheck` verde.
- Aplicar a migration: `npm run db:push:staging` e depois `npm run gen:types` para
  regenerar `types.ts` de forma canônica (a Fase 1 editou `types.ts` à mão para
  refletir as colunas novas; ADR 0007 e CLAUDE.md exigem regenerar e commitar).
- Exercício do fluxo: criar tarefa com prioridade/horas; mudar status e prioridade
  pelo card; agrupar por cada critério; filtrar por tipo; abrir disciplina (vai ao
  projeto); excluir tarefa; conferir que não-admin só vê o próprio trabalho.

## Relacionados

- `docs/specs/008-gestao-meu-trabalho.md` (base: tabela `tarefas`, RPC de disciplinas)
- `docs/specs/013-criacao-leve-e-acabamento-da-unidade-de-trabalho.md` (etiquetas,
  links, anexos, comentários; recusa do board configurável; horas fora de escopo)
- `docs/specs/012-gestao-workload-e-cronograma-equipe.md` (horas dependem da captura)
- Migration `20260730000300_tarefas_rls_pessoal.sql` (todo usuário gerencia as
  próprias tarefas; admin administra as de todos)
