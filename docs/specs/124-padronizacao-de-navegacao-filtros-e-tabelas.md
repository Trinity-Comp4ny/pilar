# SPEC 124: Padronização de navegação de seção, filtros e tabelas

**Data:** 2026-10-15
**Status:** Entregue em 6 fases no PR #636 (com as pendências abaixo)
**Autor:** Matheus
**Módulo:** transversal (shell, Tarefas, Projetos, Leads, Clientes, Propostas, Financeiro, Obras)
**ADR:** [0058](../architecture/adr/0059-navegacao-de-secao-e-toolbar-padrao.md)

## Problema

Cada tela montou o próprio controle de navegação e de filtro, porque o design system não
define contrato para eles. Resultado, apurado por leitura do código em 2026-10-15:

- **Seção da página** tem dois padrões: sidebar vertical de 240px (`SecondSidebar` no
  Financeiro, Admin e detalhe de Projeto) e barra horizontal de abas (`TabsList` em Obra,
  Cliente, Fornecedor, Timesheet). No Financeiro empilham até 4 colunas de navegação
  (rail, painel do módulo, `SecondSidebar`, `ContasSidebar` na Carteira).
- **Seletor de visão** (Lista/Quadro/Agenda e afins) existe em 8 variações feitas à mão,
  com raio, fundo e estado ativo diferentes. Em Tarefas, o seletor é `rounded-lg` e os
  filtros ao lado são pills `rounded-full`.
- **Filtros** ficam em 6 lugares diferentes (header, toolbar solta, `CardHeader`, dentro
  de `CollapsibleKpiSection`, card próprio, barra de Lançamentos). 143 `SelectTrigger`
  usam o padrão `h-10 rounded-md` e 12 usam `h-9 rounded-full` inline. O popover
  "Filtros (n)" existe 3 vezes. Período tem 5 formas.
- **Tabelas**: 13 arquivos usam `DataTable`, 15 usam `<Table>` à mão (incluindo as listas
  principais) e 5 usam `<table>` crua. Altura de cabeçalho, densidade e wrapper variam.

Quem sente: todo usuário que troca de módulo e reaprende onde ficam as seções e os filtros.

## Objetivo

Toda página segue a mesma ordem vertical: header (título, busca, ação primária), abas de
seção (se houver), toolbar (visão e filtros), conteúdo. Cada peça tem um componente único,
documentado no DS e protegido por teste de varredura.

**Fora de escopo:** conteúdo das telas, regras de negócio dos filtros, telas dormentes,
landing, portal do cliente, `LancamentosTable` (exceção documentada: server-side, agrupada).

## Requisitos

1. **`SectionTabs`**: barra horizontal de seção. Sublinhado no item ativo (barra `bg-ink`,
   texto `text-ink`), sem fundo cinza. Suporta ícone, badge de contagem, item desabilitado
   e `data-tour`. Rola na horizontal quando não cabe e centraliza o ativo. Teclado: setas,
   Home e End. Substitui `SecondSidebar` e os `TabsList` de seção.
2. **`ViewSwitcher`**: segmented único para trocar a visão da mesma coleção (Lista/Quadro/
   Agenda, Quadro/Lista, Tabela/Gantt/Fluxo, Diário/Mensal). Ativo `bg-brand text-ink`.
3. **`FilterBar` e peças**: `FilterBar` (layout), `FilterSelect` (escolha única),
   `MultiSelectFilter` e `FiltroPeriodo` (já existem, ajustados), `FilterPopover`
   ("Filtros (n)" com cabeçalho e "Limpar"). Tudo `h-9 rounded-full`. Filtro ativo fica
   `bg-brand text-ink`. Todos mostram "Limpar" quando há filtro ativo.
4. **Slots no layout**: `PageLayout` e `PilarPage` ganham `tabs` e `toolbar`, renderizados
   dentro do bloco sticky do header, nesta ordem: header, chips mobile, abas, toolbar.
5. **Tabelas**: toda lista plana usa `DataTable`. Altura de cabeçalho e densidade vêm do
   `DataTable`, o wrapper é um só e o título "Lista de X" some (o título da página basta).
6. **Guardas**: teste de varredura que reprova import novo de `SecondSidebar`, `<Table>`
   à mão em `src/pages/**` fora da allowlist, e `SelectTrigger` com `rounded-full` inline.

Requisitos não-funcionais:

- **Mobile (390px)**: abas e toolbar rolam na horizontal sem deslocar a página; o header
  continua com busca em ícone e ação primária em ícone (achados da auditoria mobile).
- **A11y**: `role="tablist"`/`tab` com `aria-selected`; segmented com `aria-pressed` ou
  `role="radiogroup"`; foco visível; alvo de toque mínimo de 36px.
- **Cor**: só token semântico. Verde da marca só como fundo, nunca como texto ou ícone.

## Critérios de aceite

- [ ] Dado `SectionTabs` com 3 itens, quando o usuário pressiona seta direita no item ativo,
      então o foco vai para o próximo item e `onValueChange` dispara.
- [ ] Dado item `disabled`, quando clicado ou navegado por seta, então não é ativado.
- [ ] Dado `ViewSwitcher` com valor "quadro", então só "quadro" tem `aria-pressed="true"`.
- [ ] Dado `FilterSelect` com valor diferente do padrão, então o gatilho tem `bg-brand` e
      mostra o botão de limpar.
- [ ] Dado `PilarPage` com `tabs` e `toolbar`, então ambos ficam dentro do bloco sticky e
      abaixo do header.
- [ ] Financeiro: as 5 seções aparecem como abas sob o header; não existe 3ª coluna;
      deep-link `?tab=lancamentos` continua abrindo a aba certa.
- [ ] Tarefas: Lista/Quadro/Agenda e os filtros ficam na toolbar, com o mesmo raio e altura.
- [ ] Caso de borda: 390px com 5 abas, a aba ativa nasce visível e a página não desloca.
- [ ] Teste de varredura falha ao importar `SecondSidebar` numa página nova.

## Dados e contratos

Sem banco. Componentes novos em `src/components/` (`SectionTabs`, `ViewSwitcher`) e
`src/components/filters/` (`FilterBar`, `FilterSelect`, `FilterPopover`).

## Plano de implementação

Um PR por fase, todos de `origin/staging`.

1. **Fase 1 (este PR)**: spec, ADR, primitivos com teste, slots `tabs`/`toolbar`,
   atualização do DS. Primeiros consumidores para validar: Tarefas (toolbar) e Financeiro
   (abas). Admin usa o mesmo padrão do Financeiro e migra junto.
2. **Fase 2**: Projetos e Leads (toolbar, `ViewSwitcher`, extrai o popover de Projetos para
   `FilterPopover`).
3. **Fase 3**: Financeiro restante (Lançamentos, Folha, Carteira sem 4ª sidebar, título
   duplicado de Lançamentos).
4. **Fase 4**: Clientes, Propostas, Obras e Fornecedores (lista e detalhe), Timesheet,
   Relatórios, detalhe de Projeto (último consumidor do `SecondSidebar`, que então é
   removido).
5. **Fase 5**: tabelas `<Table>` à mão para `DataTable`.
6. **Fase 6**: guardas (varredura e lint) e remoção das exceções.

## Decisões e riscos

- ADR [0058](../architecture/adr/0059-navegacao-de-secao-e-toolbar-padrao.md): navegação
  de seção horizontal, toolbar sticky abaixo do header, filtro ativo em verde sólido.
- Risco: o bloco sticky cresce (header 56px + abas ~44px + toolbar ~52px = ~150px) e rouba
  altura em telas baixas. Mitigação: toolbar de uma linha, sem quebra, rolando na horizontal.
- Risco: baselines do teste visual E2E mudam em toda tela migrada. Atualizar a referência
  por fase.
- Pendente de decisão: o visual das abas segue "sublinhado ink". Se não agradar
  no uso real, ajustar só o `SectionTabs` (um arquivo) sem tocar nas páginas.

## Entrega (PR #636) e o que ficou de fora

Antes e depois de cada tela em [`docs/design/antes-depois/spec-124/`](../design/antes-depois/spec-124/).

- **Fase 1**: `SectionTabs`, `ViewSwitcher`, `FilterBar` e peças, slots `tabs`/`toolbar`. Financeiro, Admin e Tarefas.
- **Fase 2**: Projetos e Leads (visão, filtros e ordenação na toolbar; KPI sem controles).
- **Fase 3**: Financeiro. `PageToolbar`/`PageTabs` (portal) deixam a aba montar a própria toolbar:
  Lançamentos e Folha. Período da Visão Geral na toolbar. Título duplicado de Lançamentos removido.
  `FiltroCompetencia` e os toggles de gráfico usam as peças padrão.
- **Fase 4**: Clientes, Propostas, Equipe (toolbar), detalhe de Obra, Cliente, Fornecedor e Projeto
  (`SectionTabs`), Cronograma e Diário da Obra, Agenda e Mapa (peças padrão). `SecondSidebar` removido.
- **Fase 5**: `ListaLeads`, `ListaProjetos` e `CompanyUsersTab` em `DataTable`.
- **Fase 6**: varredura em `src/components/navegacaoPadrao.test.ts` (sem `SecondSidebar`, sem pill
  `SelectTrigger h-9`, sem segmented à mão, sem tabela nova à mão, com lista de exceções que só encolhe).

**Pendências (decisão consciente, não esquecimento):**

- 9 listas seguem com `<Table>` à mão por terem comportamento que o `DataTable` não cobre hoje
  (edição inline, linha expansível, ordenação em botão, agrupamento): Propostas, Folha, Disciplinas,
  Auditoria, Rentabilidade, Fornecedor (detalhe), Usuários (admin), Lançamentos (exceção documentada).
  Cada uma está listada com o motivo no teste; migrar exige estender o `DataTable`.
- `ContasSidebar` da Carteira é lista mestre-detalhe de contas, não navegação: mantida.
- Relatórios (barra de parâmetros) é formulário de geração, não filtro de lista: mantido.
- Timesheet (dormente) não foi tocado.
- Busca local de aba (Lançamentos, Folha, Equipe) fica na toolbar, porque o header é da página inteira.
