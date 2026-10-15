# SPEC 122: Card e Kanban padrão

**Data:** 2026-10-15
**Status:** Em implementação
**Autor:** Matheus
**Módulo:** transversal (Tarefas, Projetos, Leads)

## Problema

Os três quadros Kanban montam card, coluna e ordenação cada um do seu jeito:

- **Card**: raio, padding e ritmo vertical diferem (`space-y-1.5` num, blocos soltos noutro);
  Tarefas mostra "#N" na face; a etiqueta "Tarefa" fica deslocada do canto porque o menu
  invisível (aparece só no hover) reserva espaço ao lado dela.
- **Coluna**: Tarefas usa cabeçalho em sentence case e superfície `bg-muted/40`; Projetos e
  Leads usam MAIÚSCULAS e `bg-muted`, larguras de 288px e 280px, textos de coluna vazia
  diferentes. Menu da coluna e coluna minimizada duplicados em 3 lugares.
- **Ordenação**: só Projetos tem controle de ordem (5 chaves, "Crescente/Decrescente");
  Leads tem um `Select` de outro formato; Tarefas não tem.
- **Prioridade**: cores do ponto diferem entre Tarefas e Projetos.
- **Filtro de pessoa (Tarefas)**: lista "Eu" e, logo abaixo, o próprio nome da mesma conta.

## Objetivo

Um card, uma coluna e um controle de ordenação, usados pelos três quadros. A tela só preenche
os espaços; raio, padding, posição das peças e rótulos vêm do componente.

**Fora de escopo:** conteúdo de cada card (continua variando por tela), filtros e toolbar
(SPEC 121), listas e tabelas, visão mobile de Projetos e Leads.

## Requisitos

1. **`KanbanCard`** (`src/components/kanban/KanbanCard.tsx`): `rounded-lg`, `p-3`, `gap-2`.
   Slots: `eyebrow` (prioridade, alertas), `tag` (tipo), `menu`, `title`, `subtitle`, `meta`,
   `footer`. O menu é sempre visível e fica no canto; sem eyebrow nem tag ele divide a linha
   com o título. Nenhum "#N" na face (o número continua no detalhe e na busca).
2. **`KanbanColumn` e `KanbanDraggable`** (`src/components/kanban/KanbanColumn.tsx`): cabeçalho
   com ponto, nome em sentence case, contagem e menu (editar, mover, excluir); superfície
   `rounded-xl bg-muted/40`; coluna minimizada; estado vazio "Nada aqui". Medidas em
   `kanbanLayout.ts` (280px, "Nova coluna" alinhado ao início da superfície).
3. **Ordenação** (`src/lib/kanbanSort.ts`, `KanbanSortControl`): chaves `priority`, `dueDate`,
   `value`, `name`, `created`; cada quadro declara as suas. Direção com rótulo da chave
   ("Alta primeiro", "Mais próxima primeiro"). Vazio vai para o fim nas duas direções.
   Projetos guarda na URL (`?sort=`), Tarefas e Leads por navegador.
4. **Prioridade**: um só mapa de cor do ponto (`bg-destructive`, `bg-warning`,
   `bg-muted-foreground/40`) em Tarefas e Projetos.
5. **Filtro de pessoa**: sem opção "Eu". A pessoa do usuário aparece uma vez, no topo, com
   "(você)". Link antigo com `pessoas=eu` continua valendo.

## Critérios de aceite

- [x] Dado um card de tarefa com número, então a face não mostra "#N".
- [x] Dado um card sem eyebrow e com menu, então não existe linha de cabeçalho vazia.
- [x] Dado o mesmo conjunto de dados, `ordenarKanban` com `dueDate` desc põe itens sem data por último.
- [x] Dado o filtro de pessoa com o usuário logado na lista, então o nome dele aparece uma vez
      e não existe item "Eu".
- [x] Dado `value: ["eu"]` (link antigo), então o gatilho mostra o nome do usuário.
- [x] Tarefas, Projetos e Leads mostram o mesmo controle "Ordenar por".
- [ ] Leads sem permissão de financeiro não oferece ordenar por valor (verificar em staging).

## Dados e contratos

Sem banco. `usePessoasEmpresa` passa a devolver `profileId` por pessoa, para achar a pessoa
do usuário quando a consulta de "minha pessoa" não resolve.

## Decisões e riscos

- Cartão inteiro clicável; o título é um `<button>` para o foco de teclado.
- Risco: baselines do teste visual E2E dos quadros mudam. Atualizar a referência após o merge.
- Conflito esperado com a SPEC 121 (PR #636) em `FiltrosTrabalho.tsx` e `meu-trabalho/index.tsx`.
