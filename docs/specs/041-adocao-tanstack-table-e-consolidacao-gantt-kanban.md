# SPEC: Adoção do TanStack Table e consolidação de Gantt/Kanban

**Data:** 2026-08-13
**Status:** Draft
**Autor:** Matheus
**Módulo:** design-system (transversal: projetos, obras, financeiro, leads, meu-trabalho)

## Problema

Três classes de componente pesado cresceram duplicadas e sem base comum, o que
torna cada ajuste caro e inconsistente: ~31 tabelas artesanais reimplementam
sort/filtro/seleção; o Gantt tem 3 implementações (uma reimplementa a matemática
de datas que já existe em `src/lib/cronograma.ts`); o Kanban tem 3 boards que
copiam o mesmo padrão de arrastar e de "coluna inline". Quem sente: o próprio time
de manutenção (hoje, o founder solo) e, indiretamente, o ICP, que vê comportamento
divergente entre telas equivalentes.

## Objetivo

Passar a ter **uma base por classe**: uma `DataTable` sobre `@tanstack/react-table`,
um `<PilarGantt>` e um `<KanbanBoard>`, todos alimentados pelos utilitários e
tokens que já existem. Depois desta spec, criar uma tabela com ordenação/filtro/
seleção, uma timeline ou um board novo não exige reimplementar a mecânica.

Segue a regra do [ADR 0020](../architecture/adr/0020-headless-sim-widget-estilizado-nao.md):
headless (TanStack Table) entra; widget estilizado não.

**Fora de escopo:**

- Trocar `@hello-pangea/dnd` por `@dnd-kit`/Pragmatic DnD (só se React 19 forçar; ADR 0020).
- Comprar/adotar biblioteca de Gantt (turnkey estilizado, recusado no ADR 0020).
- Gerador de página (`npm run generate:page`) e visual-regression CI: gold-plating para agora.
- Mudança visual das telas. Migração é interna; a aparência não muda.
- Reescrever as ~31 tabelas de uma vez (migração é incremental, por impacto).

## Requisitos

Funcionais, testáveis:

1. Existe uma `DataTable` genérica sobre `@tanstack/react-table` que suporta
   ordenação, filtro por coluna, seleção de linha (checkbox) e visibilidade de
   coluna, expondo estados obrigatórios `isPending`/`error`/vazio.
2. A `DataTable` preserva a API pública atual (`ColumnDef` com
   `key/header/align/stickyLeft/cell/getSortValue`) para não quebrar o consumidor
   existente (`FaturasCartaoTable`).
3. A `DataTable` aceita estados de vazio/erro customizados (`emptyState`/`errorState`),
   para preservar `EmptyState` com ícone e ação ao migrar telas existentes.
4. **A `LancamentosTable` NÃO migra para a base (decisão revista após auditoria).**
   Ela é server-side (sort/filtro/paginação no banco, spec 033 / ADR 0017), agrupada
   (grupos de parcela com expand/collapse), com linhas medidas dinamicamente e scroll
   infinito. Forçá-la na base plana client-side seria regressão. Fica custom, pela
   própria regra do design system ("regra de domínio: escrever à mão"). Virtualização
   na base fica adiada até um consumidor plano real precisar (sem API especulativa).
5. Existe um `<PilarGantt>` único que renderiza linhas (planas ou hierárquicas
   pai→filho), zoom mês/semana, e emite callbacks de drag (mover/resize left/right)
   com snap. Os 3 tabs (`CronogramaTab`, `CronogramaProjetosTab`, `ObraCronogramaTab`)
   passam a consumi-lo.
6. Toda a matemática de datas do Gantt vem de `src/lib/cronograma.ts`. Nenhum tab
   reimplementa `barPosition`/`snapToBoundary`/`generateColumns`.
7. Existe um `<KanbanBoard>` único (colunas + cards arrastáveis + "coluna inline")
   sobre `@hello-pangea/dnd`, parametrizado por `columns`, `renderCard`, `onDragEnd`.
   Os 3 boards (Projetos, Leads, Meu Trabalho) passam a consumi-lo.

Não-funcionais:

- **Design system:** nada renderiza cor fora dos tokens (ADR 0008); o ESLint de
  cor crua continua verde. Nenhuma dependência nova que injete CSS próprio.
- **Performance:** `LancamentosTable` mantém virtualização (não pode voltar a
  renderizar todas as linhas). A `DataTable` não pode fazer full-render em listas
  grandes quando `virtualized`.
- **Multi-tenant:** migração é puramente de UI; isolamento por `empresa_id` nas
  RLS existentes não muda. Sem migration de banco.
- **Bundle:** `@tanstack/react-table` é a única dependência de runtime adicionada;
  o gate `check:bundle-size` deve continuar passando.

## Critérios de aceite

- [ ] Dado a `DataTable` nova, quando clico no header de uma coluna ordenável,
      então as linhas reordenam asc/desc e valores não-finitos vão para o fim
      (paridade com o comportamento atual).
- [ ] Dado uma `DataTable` com seleção, quando marco o checkbox mestre, então
      todas as linhas visíveis são selecionadas e a contagem reflete.
- [ ] Dado `FaturasCartaoTable` (consumidor atual), quando renderiza após a
      migração, então mostra as mesmas colunas/ordenação de antes (sem regressão).
- [ ] Dado `LancamentosTable` migrada, quando aplico filtro de período + tipo +
      seleção múltipla, então o resultado é idêntico ao da versão anterior e a
      lista continua virtualizada.
- [ ] Dado o `<PilarGantt>` em modo hierárquico, quando expando uma frente, então
      as tarefas-filho aparecem posicionadas pela mesma régua de datas do pai.
- [ ] Dado o `<PilarGantt>`, quando arrasto a borda direita de uma barra, então
      ela faz snap ao mês/semana e chama `onDatesChange` uma vez ao soltar.
- [ ] Dado os 3 tabs de cronograma, quando busco por `barPosition`/`snapToBoundary`
      inline, então não há nenhuma reimplementação (tudo vem de `lib/cronograma.ts`).
- [ ] Dado o `<KanbanBoard>`, quando arrasto um card entre colunas em Projetos,
      Leads e Meu Trabalho, então o `onDragEnd` persiste a mudança em cada um
      (paridade com hoje).
- [ ] Caso de borda: `DataTable` com `rows=[]` mostra empty state; com `error`
      mostra o estado de erro; com `isPending` mostra skeleton.

## Dados e contratos

- **Sem migration de banco.** Nenhuma tabela/coluna/RPC nova. `gen:types` não muda.
- Dependência nova: `@tanstack/react-table` (runtime).
- Contratos de componente (o shape público que as telas consomem):
  - `DataTable<T>`: mantém `ColumnDef<T>` atual + novas capacidades opt-in
    (`enableRowSelection`, `filterFns` por coluna, `virtualized`).
  - `PilarGantt`: `rows` (com `parentId?` para hierarquia), `zoom: "months"|"weeks"`,
    `onDatesChange(rowId, { start, end })`, `renderLabel?`, `renderBar?`.
  - `KanbanBoard<T>`: `columns`, `items`, `renderCard(item)`, `onDragEnd(result)`,
    `onCreateColumn?`.

## Plano de implementação

Ordenado por ROI (tabelas primeiro: maior duplicação, menor risco). Cada fase é
um PR próprio para `staging`, verificável isolado.

1. **Fase 1 — TanStack Table.** Instalar `@tanstack/react-table`. Reconstruir
   `src/components/data/DataTable.tsx` em cima dele preservando a API `ColumnDef`.
   Adicionar seleção, filtro e visibilidade de coluna atrás de props opt-in.
   Migrar o único consumidor atual (`FaturasCartaoTable`) e provar paridade.
2. **Fase 2 — Enriquecer a base + provar em tabela plana.** Adicionar slots
   `emptyState`/`errorState` à `DataTable`. Migrar uma tabela plana representativa
   (`fornecedores/index.tsx`) para a base: ganha ordenação por coluna, preserva os
   empty states ricos via o slot novo. `LancamentosTable` fica custom (ver req. 4).
   Demais tabelas planas migram "por toque" (regra abaixo), não em lote.
3. **Fase 3 — `<PilarGantt>`.** Extrair um componente único a partir do mais
   completo (`CronogramaTab`), fazendo-o consumir `lib/cronograma.ts`. Migrar os
   3 tabs para ele. Apagar a matemática duplicada.
4. **Fase 4 — `<KanbanBoard>`.** Extrair board + coluna + "coluna inline" comuns
   sobre `@hello-pangea/dnd`. Migrar Projetos, Leads e Meu Trabalho.
5. **Fase 5 — Enforcement (opcional, barato).** Regra no `CLAUDE.md`: tabela nova
   usa `DataTable`, timeline usa `PilarGantt`, board usa `KanbanBoard`. Subir o
   gate de cor crua de warn→error se ainda não estiver (ADR 0008).

Migração das ~31 tabelas artesanais restantes: **incremental, por toque.** Regra:
"mexeu significativamente na tela, migra para a `DataTable`". Não é um esforço
único.

## Estado da implementação (2026-08-13)

- **Fase 1 — feito** (PR #220). `DataTable` sobre `@tanstack/react-table`, paridade
  de ordenação, seleção e visibilidade opt-in, 7 testes.
- **Fase 2 — feito** (PR #220). Slots `emptyState`/`errorState`; `fornecedores/index.tsx`
  migrado (ganha ordenação, mantém empty states ricos), verificado em Chrome.
  `LancamentosTable` fica custom (req. 4). Demais tabelas migram por toque.
- **Fase 3 — em andamento** (PR #220). (a) `CronogramaTab` dedupada contra
  `lib/cronograma.ts` (-110 linhas), render/marcadores verificados em Chrome.
  (b) Motor de arraste extraído para `useGanttDrag` (`src/components/gantt/`) +
  `computeDraggedDates` puro e testado; `CronogramaTab` (com guarda-chuva via
  `constrain`) e `CronogramaProjetosTab` passam a compartilhá-lo (-120 linhas cada,
  JSX intacto). **Pendente:** `ObraCronogramaTab` (hierárquico) adotar o hook e um
  `<PilarGantt>` presentacional único (req. 5).
- **Fase 4 — pendente.** `<KanbanBoard>` consolidando os 3 boards.
- **Fase 5 — parcial.** Regra no `CLAUDE.md` (tabela plana usa `DataTable`, timeline
  usa `lib/cronograma.ts`). **Pendente:** subir gate de cor crua warn→error.

**Por que 3-full e 4 ficam pendentes:** extrair `<PilarGantt>`/`<KanbanBoard>` é
reescrever ~4.500 linhas de código de arrastar em telas usadas por cliente real
(design partner). O risco de regressão é alto e a verificação por automação de
browser NÃO exercita drag custom de forma confiável (o `left_click_drag` sintético
não dispara a sequência de mousemove que os listeners de `document` esperam). Cada
extração merece um PR próprio, exercido à mão no fluxo real antes do merge, em vez
de empacotada numa leva. O dedup da Fase 3 já entrega o ganho central do ADR (fonte
única da matemática) com risco baixo.

## Decisões e riscos

- Decisão de arquitetura: [ADR 0020](../architecture/adr/0020-headless-sim-widget-estilizado-nao.md)
  (headless sim, widget estilizado não). Esta spec é a execução dele.
- Risco: `@tanstack/react-table` tem curva de reescrita para tabelas com sticky
  columns + virtualização juntas (`LancamentosTable`). Mitiga: Fase 1 valida a base
  no caso simples antes da Fase 2 atacar o caso difícil.
- Risco: consolidar 3 Gantts num só pode achatar comportamento específico de um
  tab (ex. o "guarda-chuva" de datas do projeto). Mitiga: `PilarGantt` expõe os
  callbacks e o consumidor aplica a restrição; a régua é compartilhada, a regra
  de negócio fica na tela.
- Suposição que pode furar: `@hello-pangea/dnd` segue OK em React 18. Se subir para
  React 19 antes desta spec, a Fase 4 vira migração de lib de DnD (headless), não
  só consolidação.
