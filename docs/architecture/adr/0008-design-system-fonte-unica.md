# ADR 0008: Design system com fonte única — variants nomeadas, componentes promovidos por uso e proibição de estilo ad-hoc

**Data:** 2026-07-25
**Status:** Accepted

## Contexto

Auditoria completa dos padrões de UI (catálogo em `docs/design/CATALOGO_UI.md`,
branch feat/header-padrao @ 2a377f8) encontrou:

- **105 botões de marca re-estilizados via className** repetindo `bg-brand text-ink
hover:bg-brand/90`, enquanto o `Button` já tinha essa variant pronta com o nome
  legado `orange` (`src/components/ui/button.tsx:21`) e **zero usos**. A deriva já
  produziu divergência real (`hover:bg-brand/85` vs `/90`).
- **~70 pontos de formatação de moeda** com 3 formatadores concorrentes de
  comportamento DIFERENTE (`lib/utils.ts:23` e `lib/currencyUtils.ts:8` com 2 casas,
  `lib/currency.ts` com 0 casas) + 26 redefinições locais + 42 inline. Num produto
  cuja promessa é número confiável, é a deriva mais cara.
- **6+ mapas de status locais** com cores divergentes para o mesmo conceito
  ("Pago" = emerald hardcoded em `Relatorios.tsx:36`, token `positive` no financeiro).
- **177 usos de paleta crua Tailwind em 52 arquivos**, violando a regra "primitives
  nunca direto" declarada no próprio `tokens.css`.
- **155 spinners ad-hoc**, 2 componentes distintos chamados `KPICard`, 19
  `AlertDialog` crus paralelos ao `ConfirmDialog`, 17+ `formatDate` locais copiando
  o fix de timezone na mão, e a classe morta `vrz-card` em 13 arquivos.

Diagnóstico: **o sistema existe (shadcn/ui + tokens.css), o que falta é nome
descobrível, promoção disciplinada e enforcement.** Sem regra, cada tela nova
reintroduz deriva e o custo de manutenção cresce linearmente com o número de telas.

## Decisão

1. **Hierarquia de fonte única (nesta ordem, sem exceção):**
   tokens semânticos (`src/styles/tokens.css`) → variants de componentes shadcn
   (`src/components/ui/`) → componentes compartilhados (`src/components/`) →
   composição na página. Página NUNCA define cor, raio, sombra ou tipografia de
   componente via className; className em página é só layout (grid, gap, width,
   visibilidade responsiva).
2. **Variant antes de componente novo.** Estilo recorrente de um componente shadcn
   vira variant nomeada pelo PAPEL (ex.: `variant="brand"`), nunca pela cor.
   `orange` é renomeada para `brand`; nomes por cor ficam proibidos.
3. **Regra dos 3 usos.** Padrão repetido em 3+ lugares é promovido a componente
   compartilhado em `src/components/`, extraindo a MELHOR implementação existente
   (não escrevendo do zero). Abaixo de 3 usos, fica local.
4. **Formatação é biblioteca única:** `src/lib/format.ts` absorve moeda, data,
   percentual e número. Os 3 formatadores de moeda colapsam em um (2 casas por
   padrão, opção explícita para 0). `currency.ts`/`currencyUtils.ts` viram
   re-exports deprecados até a migração terminar, depois somem.
5. **Enforcement automatizado, não combinado:** regra de lint (no-restricted-syntax
   para `bg-brand|text-brand|bg-emerald|bg-red-[0-9]` etc. em `src/pages/**`) +
   grep de CI. Qualidade não automatizada não existe.
6. **Escopo de agora:** Button/Badge variants, StatusBadge, formatação, KPICard
   único, spinner/skeleton padrão, ConfirmDialog como único confirm. **Fora por
   enquanto** (padronização prematura): DataTable genérico, form engine, telas
   dormentes, landing, cards do chat.

## Consequências

- Editar `button.tsx` ou `tokens.css` passa a propagar para o app inteiro de fato;
  o custo de manutenção de UI deixa de crescer com o número de telas.
- Migração tem custo único (ondas na spec `docs/specs/003-design-system.md`) e
  gera diffs grandes porém mecânicos; o codemod de className→variant é o grosso.
- O lint novo vai acusar código legado até a última onda terminar; a regra entra
  como warning e vira error quando a onda correspondente fecha.
- Componentes compartilhados ganham teste próprio; página perde liberdade de
  "ajustezinho" local (isso é objetivo, não efeito colateral).
- Novos contribuidores (ex.: Kelson) herdam um caminho óbvio: se não existe
  variant/componente, a PR primeiro promove, depois usa.

Relacionados: ADR 0005 (permissões/feature flags), spec 001 (shell), spec 002
(header), `docs/design/CATALOGO_UI.md` (inventário e números), regra de marca em
`brand/visual.md` e memória "regra verde da marca".
