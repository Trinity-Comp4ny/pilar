# SPEC 127: DataTable estendido e migração das listas restantes

**Data:** 2026-10-15
**Status:** Entregue (fases 1, 2 e 3)
**Autor:** Matheus
**Módulo:** transversal (tabelas de Propostas, Fornecedor, Auditoria, Usuários, Disciplinas, Folha, Rentabilidade, Lançamentos)
**Depende de:** [SPEC 124](./124-padronizacao-de-navegacao-filtros-e-tabelas.md), [ADR 0020](../architecture/adr/0020-headless-sim-widget-estilizado-nao.md)

## Problema

A SPEC 124 padronizou navegação, filtros e seletor de visão, mas deixou 9 telas com tabela escrita à mão
(`<Table>`), cada uma com cabeçalho, altura de linha, ordenação e estado vazio próprios. O `DataTable` não
cobre o que elas fazem: linha com rótulo e atalho de teclado, linha dimensionada por estado, linha
expansível, edição na célula, agrupamento com totais. A lista de exceções (com motivo por arquivo) está em
`src/components/navegacaoPadrao.test.ts`. Quem sente: qualquer usuário que alterna entre Propostas, Folha e
Lançamentos e vê três tabelas diferentes.

## Objetivo

Toda lista plana do app usa o `DataTable`, então cabeçalho, densidade, ordenação, vazio e erro são
iguais. A lista de exceções do teste de varredura fica vazia, exceto `LancamentosTable` (server-side,
agrupada, scroll infinito), que só alinha o visual.

**Fora de escopo:** mudar regra de negócio das telas; Timesheet (dormente); tabelas dentro de diálogo
(importação, nota fiscal), que ficam como estão.

## Requisitos

### Fase 1: recursos de linha (Propostas, Fornecedor, Auditoria, Usuários do admin)

1. `DataTable` aceita `rowClassName(row)` para estado visual da linha (ex.: convite pendente esmaecido).
2. `DataTable` aceita `rowLabel(row)`. Com `onRowClick`, a linha fica focável (`tabIndex=0`), abre com Enter
   ou Espaço quando o foco está na própria linha (não em botão interno) e mostra anel de foco.
3. `DataTable` aceita `renderExpanded(row)` e `expandedIds`. Linha cujo id está em `expandedIds` ganha uma
   linha extra com `colSpan` total e o conteúdo devolvido. O pai controla quem expande (normalmente pelo
   `onRowClick`).
4. Ordenação controlada pelo pai já existe (`sortingState`/`onSortingChange`); Propostas passa a usá-la
   porque o mesmo vetor ordenado alimenta a visão em cards.
5. Migram: tabela de Propostas, tabelas Obras/Compras/itens da cotação do detalhe de Fornecedor,
   duas tabelas de Auditoria e a de Usuários do admin (`UsersAccessManager`).

### Fases seguintes (cada uma com sua entrada aqui antes de codar)

- **Fase 2 (entregue):** Disciplinas, Folha e Rentabilidade, mais os alternadores de visão e de escala que
  ainda eram feitos à mão. Ver "Entrega da fase 2".
- **Fase 3 (entregue):** Lançamentos. Decisão: alinhar o visual, não migrar a mecânica. Ver "Entrega da fase 3".

Requisitos não-funcionais:

- **A11y:** linha clicável é alcançável por teclado; nenhum botão dentro da linha perde o próprio foco.
- **Sem regressão:** as 16 tabelas que já usam `DataTable` não mudam de comportamento sem `rowLabel`
  (a linha só vira focável quando recebe `onRowClick`, o que já era clicável com o mouse).

## Critérios de aceite

- [ ] Dado `rowClassName` retornando "opacity-70" para uma linha, então só essa linha tem a classe.
- [ ] Dado `onRowClick` e `rowLabel`, quando o foco está na linha e o usuário pressiona Enter, então
      `onRowClick` dispara; quando o foco está num botão dentro da linha, então não dispara.
- [ ] Dado `expandedIds` com o id de uma linha e `renderExpanded`, então aparece a linha extra com o
      conteúdo; sem o id, não aparece; com `renderExpanded` devolvendo `null`, não aparece.
- [ ] Propostas: clicar em Título/Valor/Validade ordena, alterna asc/desc e a visão em cards usa a mesma ordem.
- [ ] Auditoria: clicar na linha expande o diff JSON e clicar de novo recolhe.
- [ ] Usuários do admin: convite pendente aparece esmaecido; botões Editar e Remover seguem funcionando.
- [ ] Teste de varredura: Propostas, Fornecedor, Auditoria e Usuários saem da lista de exceções.

## Dados e contratos

Sem banco. Mudança de API só em `src/components/data/DataTable.tsx` (props novas, todas opcionais).

## Plano de implementação

1. SPEC (este arquivo) e capturas do antes.
2. `DataTable`: props novas + testes.
3. Migrar as 4 telas; atualizar a lista de exceções.
4. Depois: capturas, verificação, PR com antes e depois.

## Decisões e riscos

- A decisão de API da fase 2 saiu mais simples que o previsto: a célula já aceita qualquer componente, então o
  editor inline é controlado pela tela (o `DataTable` não sabe de edição); o "agrupamento" de Disciplinas é só
  visual (setinha na linha repetida) e o total de Rentabilidade já cabia no `footer`. Só faltaram `density` e
  `extraRows`.
- Risco: tornar a linha focável muda a ordem de Tab nas 16 tabelas existentes que têm `onRowClick`.
  Mitigação: só linha com `onRowClick` fica focável, e o anel de foco é o mesmo do resto do app.
- Auditoria no seed local não tem registros: o comportamento de expandir fica coberto por teste do
  `DataTable`, não por captura de tela.

## Entrega da fase 1

Antes e depois em [`docs/design/antes-depois/spec-127/`](../design/antes-depois/spec-127/).

- `DataTable` ganhou `rowLabel`, `rowClassName`, `renderExpanded` e `expandedIds`; linha com `onRowClick` virou
  focável e abre com Enter ou Espaço (só quando o foco está na própria linha). 5 testes novos.
- Migradas: Propostas (ordenação controlada pelo pai, a visão em cards usa a mesma ordem), Fornecedor (obras,
  compras e itens da cotação), Auditoria (as duas tabelas, com linha expansível) e Usuários do admin.
- `UsersAccessManager` passou do teto de tamanho ao extrair colunas; as colunas foram para
  `usersAccessColumns.tsx` e o arquivo saiu da lista de tamanho (636 linhas).
- Auditoria não tem registros no seed local: o expandir está coberto por teste do `DataTable`, não por captura.
- Pendente na fase 1: nenhum item. Faltam as fases 2 (edição na célula e agrupamento) e 3 (Lançamentos).

## Entrega da fase 2

Antes e depois em [`docs/design/antes-depois/spec-127/`](../design/antes-depois/spec-127/) (arquivos `fase2-*`).

- `DataTable` ganhou `density="compact"` (cabeçalho de 36px em caixa alta pequena, células com menos respiro)
  e `extraRows` (linhas depois do corpo; com ele a lista vazia não mostra a mensagem de vazio). 3 testes novos.
- Migradas: tabela de disciplinas do projeto (`DisciplinasTableView`, com a linha de adicionar extraída para
  `DisciplinaNovaLinha`), tabela da aba Disciplinas (`DisciplinasTab`, antes `<table>` crua), `FolhaTable` e as
  duas tabelas de Rentabilidade (projeto e cliente).
- Corrige um desalinhamento existente: o rodapé TOTAL de Rentabilidade por projeto tinha 9 células para 8
  colunas, então Receita, Custo e Margem apareciam sob a coluna errada. O `footer` do `DataTable` é montado
  por coluna e não tem esse problema.
- Folha: o rótulo "Ver detalhes de" agora só existe no preview (folha fechada não abre detalhe).
- `ZoomSwitcher` (Meses/Semanas) substitui o grupo de botões `rounded-none` repetido em `CronogramaTab`,
  `CronogramaProjetosTab` e `CronogramaGantt`; o alternador Cards/Tabela de Disciplinas virou `ViewSwitcher`.
- Guarda nova: o teste de varredura barra `<Button ... rounded-none>` (grupo de botões à mão). Saíram da lista
  de exceções os 4 arquivos migrados; resta só `LancamentosTable` (fase 3), Timesheet (dormente) e tabelas de diálogo.
- Teto de tamanho: `DisciplinasTableView` ficou em 776 linhas (era 788); helpers de data foram para
  `pages/projetos/lib/limitesDeData.ts`.

## Entrega da fase 3

Antes e depois em [`docs/design/antes-depois/spec-127/`](../design/antes-depois/spec-127/) (arquivos `fase3-*`).

- **Decisão:** `LancamentosTable` não migra para o `DataTable`. Ele é server-side, agrupado por parcela,
  virtualizado (`useVirtualizer`, linhas medidas) e com seleção em massa; mover isso para o `DataTable` seria
  reescrever a parte mais sensível do Financeiro para ganhar só consistência visual, que se obtém mais barato.
- `src/components/ui/table.tsx` exporta `TABLE_HEAD_CLASS` e `TABLE_CELL_DENSE_CLASS`. `TableHead` (e, por ele,
  o `DataTable`) usa a mesma `TABLE_HEAD_CLASS`; `LancamentosTable` e o novo `LancamentosSortableTH` importam as
  mesmas constantes. Cabeçalho agora tem o tamanho, o peso e os ícones de ordenação do `DataTable`.
- Densidade mantida de propósito: `px-3 py-3` nas células e no cabeçalho (o `DataTable` usa `px-4`), porque a
  tabela tem 11 colunas e mais respiro lateral esconderia conteúdo.
- `SortableTH` foi para arquivo próprio e o teto de tamanho de `LancamentosTable` caiu de 790 para 762 linhas.
- Guarda: o teste de varredura confere que `LancamentosTable` usa as constantes compartilhadas.
- Fica de fora (por decisão): Timesheet (dormente) e tabelas dentro de diálogos. A lista de exceções só tem esses
  e `LancamentosTable`, agora com o motivo atualizado.

## Limpeza final (restos achados na auditoria pós-fase 3)

Uma varredura depois da fase 3 achou o que as fases anteriores deixaram para trás. Antes e depois em
`docs/design/antes-depois/spec-127/` (arquivos `limpeza-*`).

- **Fornecedores (lista):** o card ainda tinha o título "Lista de Fornecedores" com contagem; saiu, e a
  contagem foi para a toolbar, como em Clientes e Propostas. Faltou na fase 4 da SPEC 124.
- **Auditoria (admin):** filtros em grade dentro do card passaram para a toolbar (`FilterSelect`, busca por
  autor, CSV e atualizar à direita); a pílula cinza "Ações Admin / Mutações de Dados" virou `ViewSwitcher`;
  o card com título "Auditoria" (repetia o título da página) saiu. As duas subabas montam a própria toolbar
  por `PageToolbar` e recebem o alternador como primeiro item.
- **Empresa (admin):** "Dados / Personalização" virou `ViewSwitcher`.
- **Ultra admin:** "Por empresa / Por agente / Últimas chamadas" (Custos de IA) virou `ViewSwitcher`; as
  seções do detalhe de empresa viraram `SectionTabs` (sem captura: o seed local não tem empresas).
- **Guarda:** o teste de varredura barra `<TabsList>` fora de uma lista com motivo (painel de detalhe
  responsivo, modal de configurações e Timesheet, dormente).
- **Fora de escopo, por decisão:** filtros dentro de card em telas internas do Ultra admin (Incidentes,
  Testes), em Metas (refeita na SPEC 123 por outra sessão) e formulários de empresa.
