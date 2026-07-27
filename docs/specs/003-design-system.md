# SPEC: Design system — migração para fonte única (ondas 1-3)

**Data:** 2026-07-25
**Status:** Draft (aguardando aprovação)
**Autor:** Matheus (com catálogo do ux-product-cartographer)
**Módulo:** UI compartilhada (transversal)

Decisão de arquitetura: `docs/architecture/adr/0008-design-system-fonte-unica.md`.
Inventário e números: `docs/design/CATALOGO_UI.md`.

## Problema

105 botões de marca ad-hoc, 3 formatadores de moeda que se comportam diferente em
~70 pontos, 6+ mapas de status com cores divergentes, 177 usos de paleta crua,
155 spinners ad-hoc, 2 KPICard concorrentes. Editar um componente hoje NÃO propaga;
cada tela nova aumenta o custo de manutenção.

## Objetivo

Depois desta spec: editar `button.tsx`, `tokens.css`, `StatusBadge` ou `format.ts`
propaga para o app inteiro, e o lint impede a deriva de voltar.

**Fora de escopo (ADR 0008, item 6):** DataTable genérico, form engine, telas
dormentes, landing, cards do chat, dark mode.

## Ondas de migração

### Onda 1 — Fundações que pagam na hora (S-M, ~1,5 dia)

1. **`Button`**: renomear `orange` → `brand` (mantém `orange` como alias deprecado
   por 1 release); codemod nas 105 ocorrências: remover as classes de cor/forma do
   className e usar `variant="brand"`. Onde o className só tinha isso, ele some.
2. **`src/lib/format.ts`**: `formatCurrency` (2 casas; `{ compact?: boolean;
decimals?: 0 | 2 }`), `formatDate`/`formatDateTime` (com o fix de timezone que
   17+ páginas copiam na mão), `formatPercent`, `formatNumber`. `lib/currency.ts` e
   `lib/currencyUtils.ts` viram re-export com `@deprecated`; migração mecânica dos
   26 locais + 42 inline. Testes de borda (0, negativo, null, >1M, timezone).
3. **Limpeza**: remover a classe morta `vrz-card` dos 13 arquivos.
4. **Lint/CI (warning)**: bloquear `variant=\"orange\"`, cores primitivas Tailwind
   (`emerald|red|green|amber-[0-9]`) e `bg-brand` via className em `src/pages/**`.

### Onda 2 — Status e feedback (M, ~1,5 dia)

5. **`StatusBadge`** único (`src/components/StatusBadge.tsx`): API
   `{ domain: "lead" | "projeto" | "proposta" | "financeiro" | "disciplina"; status: string }`,
   mapas centralizados em `src/constants/status.ts` usando SÓ tokens semânticos
   (base: o mapa de leads, único hoje 100% em tokens). Migra os 6+ mapas locais.
   "Pago" fica com a MESMA cor em todas as telas.
6. **Loading padrão**: `Spinner` compartilhado + uso de `PageSkeleton`/`TableSkeleton`
   nos fluxos principais; matar os spinners ad-hoc dos caminhos quentes (não os 155
   de uma vez; os das 10 páginas ativas).
7. **Confirmação**: `ConfirmDialog` como único caminho; migrar os 19 `AlertDialog`
   crus que confirmam destruição.

### Onda 3 — Cards e KPIs (M, ~1 dia)

8. **`KPICard` único** em `src/components/KPICard.tsx`, extraído do melhor existente
   (o de `financeiro/tabs/Lancamentos.tsx:171`, que tem loading embutido), API:
   `{ label; value; delta?; icon?; loading?; onClick? }` com `tabular-nums`.
   Migrar dashboard + financeiro + ~17 ad-hoc.
9. **`Card` de conteúdo**: padronizar o wrapper de lista/tabela
   (`rounded-2xl border border-black/5 bg-white`) como variant ou componente
   `ContentCard`, conforme contagem do catálogo.
10. **Lint vira error** para as regras da onda 1-2 já migradas.

## Critérios de aceite

- [ ] `grep -rn "bg-brand hover:bg-brand" src/pages src/components --include="*.tsx"`
      retorna 0 (hoje: 105).
- [ ] `variant="brand"` renderiza idêntico ao padrão atual do PageHeader (h-9,
      rounded-full, bg-brand, text-ink) e o hover é UM só valor em todo o app.
- [ ] Um único `formatCurrency` exportado; `rg "Intl.NumberFormat" src/pages` = 0.
- [ ] "Pago", "Pendente", "Vencido" com a mesma cor em Financeiro, Relatórios,
      Portal e detalhe do projeto (screenshot de comparação no PR).
- [ ] Editar a cor do token `--brand-accent` muda todos os botões primários sem
      tocar nenhuma página (teste manual documentado).
- [ ] Lint acusa `bg-emerald-500` novo em `src/pages/**` (teste com arquivo de
      exemplo no PR).
- [ ] `npm run test:run`, `typecheck` e `build:strict` verdes em cada onda;
      testes novos: format.ts (bordas), StatusBadge (domínios), KPICard (loading).
- [ ] Zero mudança de comportamento: PRs de onda são visuais/mecânicos; qualquer
      divergência visual intencional é listada no corpo do PR.

## Dados e contratos

Sem migration, sem RPC. Contratos novos: `lib/format.ts`, `constants/status.ts`,
`StatusBadge`, `KPICard`, `Spinner` (assinaturas acima; detalhe no plano).

## Plano de implementação

1 PR por onda, empilhados conforme necessário, cada um com os critérios da onda.
Onda 1 → 2 → 3. Total estimado: 4 dias efetivos.

## Decisões e riscos

- **Risco codemod**: 105 substituições mecânicas podem esconder 2-3 casos com
  classes extras no mesmo className; mitigação: codemod remove SÓ as classes
  conhecidas e o diff é revisado arquivo a arquivo no PR.
- **Risco formatação**: `lib/currency.ts` arredonda para 0 casas; telas que
  dependiam disso mudam de exibição. Levantar os usos dele ANTES (catálogo lista) e
  decidir por tela: 0 casas explícito ou 2 casas.
- **Risco de conflito com PRs abertos**: ondas só começam depois do merge de #138
  e #139 (evita codemod colidindo com os diffs do shell/header).
- Dark mode fica de fora; quando vier, entra pelos tokens (é o dividendo desta spec).
