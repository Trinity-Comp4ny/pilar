# Pilar Design System

Base de conhecimento única da interface da Pilar. É o contrato visual do produto: o que existe, quando usar, e o que é proibido. Serve dois leitores: você (para não decidir cor de botão e largura de modal de novo) e os agentes de IA (Claude/Codex), que devem seguir este documento em vez de copiar um padrão aleatório de outra tela.

Regra de ouro: **a página decide o conteúdo e a regra de negócio. Nunca decide cor, raio, sombra, tipografia ou largura de modal.** Isso já é decidido aqui.

Relacionados: `docs/architecture/adr/0008-design-system-fonte-unica.md` (a lei), `docs/specs/003-design-system.md` (o plano de execução), `docs/design/CATALOGO_UI.md` (o diagnóstico de deriva), `src/styles/tokens.css` (a verdade sobre cor).

---

## 1. Como usar este documento

Antes de criar qualquer UI, faça três perguntas nesta ordem:

1. **É um problema universal?** (tabela, drag & drop, date picker, gráfico, PDF, upload) → use a biblioteca já instalada. Não traga lib nova sem ADR.
2. **É algo que se repete dentro da Pilar?** (campo de dinheiro, seletor de cliente, filtro de período, modal de formulário, badge de status) → use a **primitiva Pilar** deste catálogo. Se ela não existir e o padrão aparece 3+ vezes, promova (seção 9).
3. **É regra que diferencia o produto?** (cálculo de margem, parcelas, cronograma, conciliação, fluxo de disciplinas) → escreva você mesmo. É aqui que o seu tempo vale.

Esse funil (`lib → primitiva Pilar → domínio`) evita os dois extremos: reinventar roda e virar uma colcha de bibliotecas.

---

## 2. A lei (ADR 0008, já aceita)

Não reabra estas decisões. Elas são vinculantes:

- **Hierarquia:** token → variant do shadcn → componente compartilhado → composição na página. A página é o último elo e só compõe.
- **Variant antes de componente novo.** Precisa de um botão diferente? Adicione uma variant, não um componente.
- **Nome por papel, nunca por cor.** `variant="brand"`, `variant="destructive"`. Nunca `variant="green"`.
- **Regra dos 3 usos.** Repetiu 3 vezes? Promova extraindo a melhor implementação existente, não reescrevendo do zero.
- **Formatação centralizada** em `src/lib/format.ts` (dinheiro, data, número). Nada de `Intl.NumberFormat` solto.
- **Enforcement por lint.** A deriva é barrada no ESLint, não na sua memória (seção 8).
- **Verde é a ação primária.** `Button` sem variant já sai `brand`. Verde só como fundo com texto escuro, nunca `text-brand` como primeiro plano sobre fundo claro.

---

## 3. Cor: só token, nunca paleta crua

`src/styles/tokens.css` é a fonte única. Ele tem duas camadas: **primitives** (`--c-green-500`, paleta bruta, proibido usar direto) e **semantic** (a intenção, o que o código consome). Use sempre a segunda.

### Superfície e texto
| Uso | Classe Tailwind | Token |
|---|---|---|
| Fundo base da página | `bg-surface-app` | `--surface-app` |
| Card / modal | `bg-surface-card` | `--surface-card` |
| Hover / muted | `bg-surface-muted` | `--surface-muted` |
| Separador | `border-border` / `border-border-subtle` | `--border-default` / `--border-subtle` |
| Título / texto primário | `text-ink` | `--text-ink` |
| Corpo / secundário | `text-ink-soft` | `--text-ink-soft` |
| Label / placeholder | `text-muted-foreground` | `--text-muted` |

### Dinheiro (fill vs texto, contraste AA medido)
- Valor positivo: `text-positive-strong`. Negativo: `text-negative-strong`.
- Fundo/fill: `bg-positive`, `bg-negative`.
- Nunca colora um número neutro. Só receita/despesa/saldo colorem (ver `TONE_VALUE` em `src/lib/status.ts`).

### Tons de status (família soft/mid/strong)
Cada intenção expõe `surface-*-soft`, `border-*-soft`/`-mid`, `text-*-strong`/`-mid`/`-soft`:

| Intenção | Superfície | Texto forte |
|---|---|---|
| Sucesso | `bg-success-soft` | `text-success-strong` |
| Erro/perigo | `bg-danger-soft` | `text-danger-strong` |
| Info | `bg-info-soft` | `text-info-strong` |
| Aviso | `bg-warning-soft` | `text-warning-strong` |
| Atenção (laranja) | `bg-attention-soft` | `text-attention-strong` |
| Destaque (roxo) | `bg-highlight-soft` | `text-highlight-strong` |

Proibido: `bg-red-100`, `text-amber-700`, `bg-blue-500` e afins em página ou componente de app. Furam o dark mode e o ajuste de contraste. O ESLint barra (seção 8). Exceção: `src/pages/landing/**` (marketing, fora do design system).

---

## 4. Catálogo de componentes (o que já existe)

Peças oficiais em uso. Use estas, não remonte à mão.

### Layout de página
- **`PilarPage`** (`src/components/PilarPage.tsx`): envelope oficial. Junta `PageLayout` + `PageHeader`. Props: `title`, `breadcrumbs`, `search`, `primaryAction`, `actions` (secundárias), `sidebar`, `className`, `containerClassName`, `children`. É o caminho padrão de toda página nova.
- **`PageLayout`** / **`PageHeader`** (`src/components/`): as peças que o `PilarPage` compõe. Use direto só em caso especial (header totalmente custom).

### Modais
- **`FormDialog`** (`src/components/FormDialog.tsx`): modal de formulário padrão. Props: `open`, `onOpenChange`, `title`, `description?`, `size?: "sm" | "md" | "lg"`, `onSubmit`, `submitLabel?`, `cancelLabel?`, `submitVariant?`, `isPending?`, `submitDisabled?`, `children`. Padroniza largura, footer Cancelar/Salvar, scroll e estado de envio. Não monte `DialogContent` + footer à mão.
- **`ConfirmDialog`** (`src/components/ConfirmDialog.tsx`): confirmação destrutiva. Props: `open`, `onOpenChange`, `onConfirm`, `title`, `description`, `itemName?`, `confirmText?`, `variant?`, `loading?`. **Toda exclusão passa por aqui.** Não monte `AlertDialogContent` cru.

### Estado da tela
- **`EmptyState`** (`src/components/EmptyState.tsx`): vazio orientado à ação. Props: `icon?`, `title`, `description?`, `action?`, `children?`.
- **`TableSkeleton`** / **`PageSkeleton`** / **`ui/skeleton`**: loading. Prefira skeleton a spinner central. Não use `animate-spin` solto por tela.
- **`Spinner`** (`src/components/Spinner.tsx`): quando precisar de spinner (botão, inline).

### Status
- **`StatusBadge`** (`src/components/StatusBadge.tsx`): badge de status de domínio. Props: `domain`, `status`, `className?`. A cor vem do registry, nunca por fora.
- **Registry** (`src/lib/status.ts`): fonte única. Domínios: `projeto | proposta | lead | financeiro | tipo | obra | cotacao`. Tons: `neutral | info | warning | attention | positive | danger | brand | done | highlight`. Helpers: `TONE_BADGE`, `TONE_VALUE` (cor de KPI), `TONE_COLUMN` (coluna kanban). "Pago" tem a mesma cor em Financeiro, Relatórios, Portal e detalhe de projeto.

### Números e KPIs
- **`KPICard`** (`src/components/KPICard.tsx`): card de número grande do dashboard.
- **`MoneyInput`** / **`NumberInput`** / **`PercentInput`** (`src/components/forms/`): inputs com máscara. Use em todo campo de dinheiro/número/percentual, nunca `<Input>` cru com parse à mão.

### Botão e badge (variants, não className)
- **`Button`** (`src/components/ui/button.tsx`): sem variant = `brand` (verde, ação primária). Outras: `outline`, `ghost`, `destructive`, `secondary`, `link`. Tem prop `loading`. **Nunca** `<Button className="bg-brand ...">`, isso reaplica o default e o ESLint barra.
- **`Badge`** (`src/components/ui/badge.tsx`): variants semânticas `brand | success | warning | info | attention | highlight | danger | neutral`. Para status de domínio, prefira `StatusBadge`.

### Tabela
- **`DataTable`** (`src/components/data/DataTable.tsx`): tabela declarativa com `ColumnDef<T>`, sort, sticky column e os três estados (loading/erro/vazio). É a peça oficial de tabela read-only. Hoje subutilizada (1 uso); adotar nas listas.

### Filtros
- **`FiltroPeriodo`** / **`FiltroCompetencia`** (spec 024, `src/lib/periodo.ts` para presets): filtro por range de data e por mês/ano. Não reimplemente seletor de período.

### Formatação (sempre importar, nunca redefinir)
- `src/lib/format.ts`: `formatCurrency(value, { decimals, compact })`, `formatDate`, `formatDateShort`, `formatDateTime`. Instâncias prontas: `BRL_2`, `BRL_0`, `BRL_COMPACT`.

---

## 5. Escala de largura de modal (decisão congelada)

Pare de escolher `max-w-*` caso a caso. A escala oficial do `FormDialog` é:

| `size` | Largura | Usar para |
|---|---|---|
| `sm` | `max-w-sm` (~384px) | confirmação, 1 a 2 campos |
| `md` | `max-w-lg` (~512px) | formulário padrão (a maioria) |
| `lg` | `max-w-3xl` (~768px) | formulário denso, com colunas ou tabela interna |

Precisa de mais que `lg`? Não é modal, é página. Larguras fora dessa escala (`4xl`, `6xl`, `none`) não entram sem justificativa no PR.

---

## 6. Receitas (o caminho único para tarefas comuns)

**Criar uma página de lista** → `PilarPage` com `title`, `search`, `primaryAction` (com `feature`). Conteúdo em `DataTable`. Vazio com `EmptyState`. Loading com `TableSkeleton`.

**Criar um modal de formulário** → `FormDialog size="md"`. Campos de dinheiro com `MoneyInput`. Validação com Zod (`src/schemas`) e erro inline via `FormField`/`FormMessage`, não `toast.error`.

**Mostrar um status** → `<StatusBadge domain="..." status="..." />`. Se o status não existe no registry, adicione em `src/lib/status.ts`, não crie um mapa local.

**Mostrar dinheiro** → `formatCurrency` de `@/lib/format`. Decida `decimals: 0` ou `2` no ponto de uso. Nunca redefina um `formatBRL` local.

**Mostrar data** → `formatDate` de `@/lib/format`. Não escreva `new Date(d + "T00:00:00").toLocaleDateString(...)` à mão (a âncora de fuso já está na primitiva).

**Confirmar exclusão** → `ConfirmDialog variant="destructive"`, nunca `AlertDialogContent` cru.

**Colorir qualquer coisa** → token semântico (seção 3). Se falta um token, abra o gap no `tokens.css`, não use cor crua.

---

## 7. Guia para agentes de IA

Ao pedir uma tela ao Claude/Codex, use este vocabulário em vez de "faça uma tela bonita":

> Use `PilarPage`. Ação primária é a `primaryAction` (variant brand, gateada por `feature`). Lista em `DataTable`. Vazio em `EmptyState`. Formulário em `FormDialog size="md"`, dinheiro em `MoneyInput`, validação Zod com erro inline. Status via `StatusBadge` do registry. Dinheiro/data via `@/lib/format`. Exclusão via `ConfirmDialog`. Zero cor crua: só token de `tokens.css`.

Regra para o agente ao mexer em tela legada: **tocou de forma significativa, migra para o padrão.** Não faça refatoração de 50 telas de uma vez; migre por impacto ao passar por elas.

---

## 8. Enforcement (o que o CI barra)

O `eslint.config.js` já tem regras `no-restricted-syntax` que barram a deriva em `src/pages/**` e `src/components/**` (exceto `ui/` e `landing/`):

1. `bg-brand` + `hover:bg-brand/N` na mesma classe → use `<Button variant="brand">`.
2. `variant="orange"` → renomeada para `variant="brand"`.
3. Cor primitiva Tailwind (`bg/text/border-{emerald|red|amber|blue|slate|gray|...}-NNN`) → use token semântico.
4. `new Intl.NumberFormat` direto → importe de `@/lib/format`.

**Estado atual: severidade `warn`.** Meta (ADR 0008 D5): subir para `error` (bloqueia merge) e adicionar a regra "proibido `import { supabase }` em `src/pages/**`". A subida para `error` está **gated**: só depois de zerar os violadores existentes (itens 3-6 do backlog), senão o CI reprova todo PR. Enquanto for `warn`, a deriva ainda entra.

---

## 9. Quando promover uma primitiva

Regra dos 3 usos. Ao ver o mesmo padrão pela terceira vez:
1. Verifique se é genérico (não regra de domínio).
2. Extraia a **melhor implementação existente**, não uma nova.
3. Documente aqui (seção 4) e no `/dev/ui` quando existir.
4. Só então adote nas features.

---

## 10. Fora de escopo (não padronizar agora)

O ADR 0008 fecha o escopo. Ficam de fora: DataTable genérico além do que existe, form engine próprio, telas dormentes (Projeção de caixa, Aging, DRE, WIP, Timesheet, Capacidade), a landing (marketing), e os cards do chat. Não invista esforço de padronização nesses até haver demanda.

---

## 11. Backlog de padronização (por impacto)

| # | Ação | Estado |
|---|---|---|
| 1 | Criar `PilarPage` e `FormDialog` | feito (esta leva) |
| 2 | Adotar `PilarPage`/`FormDialog` nas telas | em curso (4 telas em `PilarPage`) |
| 3 | Espalhar `MoneyInput`/`NumberInput`/`PercentInput` (10 telas hoje) | em curso |
| 4 | Migrar mapas de status locais para o registry | avançado: render-sites já consomem o registry; resta prioridade (sem token, ADR D6) e domínios novos (contrato, pessoa, entrega) |
| 5 | Matar defs locais de moeda e datas à mão | avançado: ~24 arquivos migrados para `@/lib/format` |
| 6 | Adotar `DataTable` nas listas grandes (Receitas, Despesas, Pessoas) | pendente |
| 7 | Subir ESLint de `warn` para `error` + regra `supabase` em `pages/` (após 3-6) | pendente (ainda há cor crua residual, parte intencional) |
| 8 | Migrar `useFinanceItems` (teto de 2000) para `useLancamentosPaginados` | pendente |
| 9 | Extrair `useTimelineDrag` (dedup do motor de Gantt) | pendente |
| 10 | Criar `/dev/ui` + visual regression no Playwright existente | pendente |

Manter esta tabela viva conforme os itens fecham.
