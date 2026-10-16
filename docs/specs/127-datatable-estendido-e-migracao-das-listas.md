# SPEC 127: DataTable estendido e migração das listas restantes

**Data:** 2026-10-15
**Status:** Fase 1 entregue (PR da fase 1); fases 2 e 3 pendentes
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

- **Fase 2:** edição na célula e agrupamento com totais (Disciplinas, Folha, Rentabilidade).
- **Fase 3:** Lançamentos (decidir entre migrar ou só alinhar o visual).

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

- Edição na célula e agrupamento ficam para a fase 2 porque pedem decisão de API (célula editável é
  controlada por quem? total do grupo vem de onde?). Não vale chutar agora.
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
