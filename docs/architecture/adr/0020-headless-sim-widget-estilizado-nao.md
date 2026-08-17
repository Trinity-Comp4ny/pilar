# ADR 0020: Adotar biblioteca headless, recusar widget estilizado

**Data:** 2026-08-13
**Status:** Proposed

## Contexto

O Pilar cresceu com três classes de componente interativo pesado feitas 100%
à mão, e a pergunta recorrente é "isso não deveria ser uma biblioteca?". A dúvida
por trás dela é sempre a mesma: *se eu adotar uma lib, ainda consigo customizar do
jeito que o design system exige?* Ver [ADR 0008](./0008-design-system-fonte-unica.md)
(fonte única, cor só por token, nada de estilo ad-hoc).

O estado real do código hoje (auditado):

- **Gantt:** 3 implementações separadas (`CronogramaTab` 967 linhas,
  `CronogramaProjetosTab` 834, `ObraCronogramaTab` 869), div+CSS posicionado por
  `%`, drag mouse/touch à mão, snap a mês/semana, zoom, hierarquia frente→tarefa.
  Regra de negócio grudada (avanço de frente, guarda-chuva de datas, persistência
  Supabase). `CronogramaTab` ainda reimplementa a matemática que já existe em
  `src/lib/cronograma.ts`.
- **Kanban:** 3 boards independentes (Projetos, Leads, Meu Trabalho) sobre
  `@hello-pangea/dnd`, cada um com seu `DragDropContext` e sua "coluna inline"
  duplicada. Nenhum `<Board>` compartilhado.
- **Tabelas:** nenhuma biblioteca. `src/components/data/DataTable.tsx` (própria,
  só ordenação, adotada em 1 lugar), ~31 tabelas artesanais sobre o `<Table>` do
  shadcn cada uma reimplementando sort/filtro/seleção, e 1 tabela virtualizada
  (`LancamentosTable`, 681 linhas) com tudo na mão.

O stack já é headless-first: Radix, `@tanstack/react-query`,
`@tanstack/react-virtual`, `react-hook-form`, `cmdk`. É por isso que o design
system funciona: nenhum desses impõe visual. O que falta é uma regra explícita
que oriente a decisão build-vs-buy toda vez que ela aparecer, para não reabrir a
discussão a cada componente.

A distinção decisiva não é "biblioteca sim ou não", é **o tipo de biblioteca**:

- **Headless (lógica):** entrega só o comportamento (ordenar, arrastar, filtrar,
  virtualizar). Zero DOM, zero CSS. Toda a marcação e o estilo continuam seus.
  Customização = 100%. Ex.: TanStack Table, dnd-kit, Radix, react-hook-form.
- **Turnkey / estilizado (widget):** entrega DOM + CSS + tema próprio.
  Customizar = brigar com o tema deles; os tokens do [ADR 0008](./0008-design-system-fonte-unica.md)
  quebram. Ex.: DHTMLX/Bryntum/ag-Grid Gantt, MUI DataGrid, produtos de kanban.

## Decisão

**1. Biblioteca headless pode ser adotada livremente; ela amplifica o design
system.** Critério: se a lib não renderiza marcação nem injeta CSS próprio (só
expõe estado e handlers), é elegível. O visual continua 100% sob os tokens.

**2. Widget estilizado / turnkey é recusado por padrão** para Gantt, Kanban,
tabela e qualquer superfície coberta pelo design system. Ele traz DOM e tema
próprios que colidem com os tokens. Só se reconsidera com ADR novo que aceite
explicitamente a dívida visual.

**3. Aplicação concreta desta regra às três classes de hoje:**

- **Tabelas → adotar `@tanstack/react-table`** (headless, MIT, mesmo ecossistema
  do `react-query`/`react-virtual` já instalados). Reconstruir a `DataTable`
  própria em cima dele mantendo a API `ColumnDef`. Resolve as ~31 cópias de
  sort/filtro/seleção sem tirar nenhum controle visual.
- **Gantt → manter custom, consolidar em um `<PilarGantt>`** que os 3 tabs
  consomem, todos plugados em `src/lib/cronograma.ts`. Não existe Gantt headless
  bom; os turnkey são estilizados e a regra de negócio é nossa.
- **Kanban → manter `@hello-pangea/dnd`, consolidar em um `<KanbanBoard>`.** O
  problema é a duplicação, não a lib. Migrar para outra lib de DnD não é objetivo.

**4. `@hello-pangea/dnd` fica sob observação.** É fork do react-beautiful-dnd
(arquitetura antiga, tropeça em React 19 / StrictMode concorrente). Enquanto o
projeto está em React 18 não há ação. Se/quando subir para React 19 e a lib
falhar, o sucessor é headless: `@dnd-kit` (o diretório vazio em `node_modules`
indica que já foi cogitado) ou o Pragmatic drag and drop da Atlassian. Nenhum
turnkey entra no lugar.

## Consequências

**Positivas:**

- A decisão build-vs-buy vira um teste de uma linha ("renderiza DOM/CSS
  próprio?"), não uma discussão nova a cada componente.
- O design system ([ADR 0008](./0008-design-system-fonte-unica.md)) fica
  protegido: nada de fora injeta visual que fure os tokens.
- TanStack Table apaga a maior fonte de duplicação de tabela sem custo visual,
  reusando ecossistema já presente.
- Consolidar Gantt e Kanban mata ~1.000 linhas duplicadas e deixa um ponto único
  de manutenção por classe.

**Negativas:**

- Gantt e Kanban continuam sendo código nosso para manter (aceito de olhos
  abertos: é o preço de manter controle total sobre um componente com regra de
  negócio grudada).
- Adotar TanStack Table e consolidar os widgets é trabalho de migração real, não
  um flip de flag; roda em fases (ver spec).
- Guardamos um risco conhecido em `@hello-pangea/dnd` até um eventual React 19.

## Decisões relacionadas

- [ADR 0008](./0008-design-system-fonte-unica.md): design system fonte única, o
  contrato visual que esta regra protege.
- [SPEC 041](../../specs/041-adocao-tanstack-table-e-consolidacao-gantt-kanban.md):
  o plano de execução (adoção do TanStack + consolidação Gantt/Kanban).
