# SPEC: Padronização de cards e KPIs — componente único

**Data:** 2026-07-30
**Status:** Aprovado (decisões tomadas pelo CEO)
**Autor:** Matheus
**Módulo:** UI compartilhada (transversal)

Decisão de arquitetura: `docs/architecture/adr/0008-design-system-fonte-unica.md`.
Continua a onda 3 da `docs/specs/003-design-system.md` (o `KPICard` foi criado, mas
a adoção parou em 1 tela).

## Problema

Existem **5 implementações do mesmo card de indicador**: o `KPICard` oficial
(`src/components/KPICard.tsx`, ADR 0008) e quatro reimplementações locais
(`inicio`, `leads`, `projetos`, `ultra-admin`). Só o Financeiro › Lançamentos
consome o oficial; todo o resto monta o card à mão. Consequências medidas:

- **Raio divergente:** oficial e Início usam `rounded-2xl`; todos os tabs do
  Financeiro usam o `Card` base `rounded-lg`.
- **Cor crua vs. token:** metade dos números usa `text-positive-strong` (correto),
  metade usa `text-emerald-600` / `text-red-700` / `text-blue-700` (fora do sistema),
  às vezes no mesmo módulo (VisaoGeral usa token, FluxoCaixa usa cor crua).
- **Fonte do valor sem escala:** `text-lg`, `text-xl`, `text-2xl`, `text-3xl/4xl`.
- **Fundo do card:** uns brancos, uns com `bg-red-50` / `bg-blue-50`.
- **`border-l` colorida** só em alguns (ProjectRow por prioridade, "Lucro líquido"
  brand, DisciplinasTab 4 cores) — sem regra.
- **`tabular-nums` ausente** em vários cards, desalinhando dígitos.
- **Skeletons duplicados** por tab, quando o oficial já tem `loading`.

## Objetivo

Um único componente de card de indicador em todo o app. Editar `KPICard.tsx`
propaga para todas as telas. Zero cor crua nos valores de KPI.

## Decisões de design (CEO, 2026-07-30)

1. **Cor no número por natureza do dado.** O valor herda a cor do `tone` semântico:
   `positive` → verde (`text-positive-strong`), `danger` → vermelho
   (`text-negative-strong`), demais tons (`neutral`/`info`/`warning`) → tinta
   (`text-ink`). Regra de aplicação:
   - Entrada / recebido / saldo positivo → `tone="positive"`
   - Saída / a pagar / despesa / vencido / saldo negativo → `tone="danger"`
   - Contadores (projetos ativos, nº de leads) → `tone="neutral"` (número neutro)
   - Saldo/lucro: `tone` condicional ao sinal.

   Contraste verificado em `tokens.css`: `positive-strong` = green-700 (5.07:1 sobre
   branco), `negative-strong` = red-700 (6.41:1). Não usa `text-brand` como texto
   (regra da marca: verde-500 só como fundo).

2. **Fim da risca lateral (`border-l`) nos cards.** Removida de ProjectRow,
   VisaoGeral e DisciplinasTab. A prioridade do projeto no ProjectRow passa a ser um
   **dot** colorido (`dotColor` em `PROJECT_PRIORITY_CONFIG`), não uma barra.

3. **Escopo total:** migrar todos os cards do sistema, inclusive tabs dormentes
   (Aging, WIP, Projeção, Rentabilidade, DRE), para não deixar dívida atrás.

## Contrato do `KPICard`

```
<KPICard
  label      // rótulo uppercase
  value      // number → moeda automática; string → como veio
  tone       // "positive" | "danger" | "neutral" | ... colore número + badge do ícone
  icon?      // LucideIcon, opcional, em badge circular do tom
  delta?     // variação vs período (seta + %), invert p/ despesa
  subtitle?  // linha de risco/contexto
  loading?   // skeleton embutido
  onClick?   // vira card interativo (hover/foco/teclado)
/>
```

Fixos no componente (não se repetem por tela): `rounded-2xl`, `border-black/5`,
`bg-white`, `p-4`, valor `text-lg font-bold tabular-nums`, label `text-xs uppercase
tracking-wider text-muted-foreground`.

## Critérios de aceite

- [ ] Nenhuma tela importa um `KpiCard`/`StatCard` local; todas usam `@/components/KPICard`.
- [ ] `grep -rE "text-(emerald|red|amber|blue|green|orange|yellow|gray)-[0-9]"` não
      retorna nada dentro de valor/card de KPI migrado.
- [ ] Todo valor de KPI tem `tabular-nums` (herdado do componente).
- [ ] Nenhum card de KPI tem `border-l`; ProjectRow mostra prioridade por dot.
- [ ] Número colorido conforme a natureza do dado (regra da decisão 1).
- [ ] `npm run typecheck` e `npm run test:run` passam.

## Fora de escopo

Cards não-numéricos (perfil de empresa, alerta de portal, card de projeto em grade),
DataTable, dark mode. `HealthIndexCard` mantém o score grande próprio (não é KPI de
faixa), mas troca cor inline por token.
