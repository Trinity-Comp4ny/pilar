# Catálogo de padrões UI — consistência atômica (Pilar)

_Gerado em 2026-08-12. Fonte: branch `staging`. Escopo: `src/` (React + TS + Tailwind + shadcn/ui)._

> Objetivo: catalogar o que existe, onde está sendo furado e onde estão os piores focos de
> inconsistência visual. **Não propõe solução** (a síntese é do founder). Só evidência com `arquivo:linha`.

## TL;DR

O design system **existe e é bom**: `src/styles/tokens.css` (299 linhas, primitives → semantic),
`src/lib/status.ts` (registry único de status por domínio, ADR 0008), e `tailwind.config.ts` expõe
a família semântica completa como utilitários (`bg-success-soft`, `text-info-strong`, `bg-positive/10` etc).

O problema **não é falta de sistema, é falta de adoção**. Três furos sistêmicos:

1. **1.544 ocorrências** de cor crua da paleta Tailwind (`bg-green-100`, `text-blue-700`…) que já têm token equivalente.
2. **Badge não tem variantes de status** (só 4 do shadcn: default/secondary/destructive/outline). Toda badge de status "inventa" o className → caos de cor. O mapa canônico (`TONE_BADGE`) existe mas não está ligado ao componente.
3. **Botão primário ambíguo**: `variant="brand"` (verde) é usado 125×, `variant="default"` (preto) só 3× — mas o **defaultVariant do componente é `default` (preto)**. Todo `<Button>` que esquece `variant="brand"` renderiza **preto**. É a origem literal de "preto vs verde na mesma tela".

---

## 1. Design system base

### Tokens (`src/styles/tokens.css`)
Arquitetura correta: `PRIMITIVES` (paleta bruta, "nunca usar direto") → `SEMANTIC` (o que o código consome).
Famílias semânticas **existem** (linhas 190-235): `success`, `danger`, `warning`, `info`, `attention` (orange), `highlight` (purple), cada uma com `-soft` (bg), `-soft-border`, `-strong`/`-mid`/`-soft` (texto). Mais:
- `--positive` / `--negative` (fill) e `--positive-strong` / `--negative-strong` (texto, WCAG AA garantido) — linhas 152-159.
- `--status-*` (planning/progress/review/done/paused/cancelled/unknown) — linhas 172-179.
- `--pipeline-*` para etapas de lead — linhas 237-242.
- `--chart-*` para gráficos — linhas 161-170.

**Todos expostos no Tailwind** (`tailwind.config.ts:76-152+`): `bg-success-soft`, `text-success-strong`, `bg-info-soft`, `text-warning-strong`, `bg-attention-soft`, `text-highlight-strong`, `bg-positive`, `text-negative-strong`, `bg-status-done`, etc.
Ou seja: **para cada cor crua existe um token pronto**. Não falta destino, falta uso.

### Registry de status (`src/lib/status.ts`)
Fonte única (ADR 0008). `STATUS_REGISTRY` por domínio (`projeto`/`proposta`/`lead`/`financeiro`/`tipo`/`obra`/`cotacao`), cada status → `tone` semântico. Mapas `TONE_BADGE`, `TONE_VALUE`, `TONE_COLUMN` traduzem tone → classes tokenizadas. Helpers `statusLabel()`, `statusBadgeClasses()`, `statusColumnClasses()`.
**Este é o padrão canônico.** O problema é quem não o usa (ver §6).

### Componentes-base (`src/components/ui/`) — variantes/tamanhos disponíveis

| Componente | Variantes | Tamanhos | Raio | Observação |
|---|---|---|---|---|
| **Button** (`button.tsx`) | `default` (preto), `destructive`, `outline`, `secondary`, `ghost`, `link`, `brand` (verde), `orange` (@deprecated, alias de brand) | `default` h-10, `sm` h-9, `lg` h-11, `icon` h-10 | `rounded-full` (pílula) | defaultVariant = **`default` (preto)**. Base tem "sheen" no hover (::before) + `active:scale-[0.98]` |
| **Badge** (`badge.tsx`) | `default`, `secondary`, `destructive`, `outline` | — (fixo) | `rounded-full` | **Sem variante de status** (success/warning/info). Raiz do caos de badges. |
| **Input** (`input.tsx`) | — | h-10 fixo | `rounded-md` | Sem estado de erro embutido (só `focus-visible:ring`) |
| **Select** (`select.tsx`) | — (Radix) | h-10 (trigger) | `rounded-md` | Trigger alinhado ao Input |
| **Checkbox** (`checkbox.tsx`) | — (Radix) | h-4 w-4 | `rounded-sm` | Usa `border-primary` + `data-[state=checked]:bg-primary` |
| **Card** (`card.tsx`) | — | — | `rounded-lg` | `shadow-sm`; header/content padding `p-6` |

**Divergência de raio já na base**: Button = `rounded-full`, Input/Select = `rounded-md`, Card = `rounded-lg`, Checkbox = `rounded-sm`. Coerente por tipo, mas note que botões são **sempre pílula** — qualquer `rounded-md`/`rounded-lg` num `<Button>` é desvio.

---

## 2. Botões — variante e tamanho

### Contagem de uso de variante (ocorrências)
```
304  outline
197  ghost
125  brand      ← verde, é o CTA de fato
 70  secondary
 33  destructive
  3  default    ← preto explícito
  1  link
```
90 arquivos usam `variant="brand"`. Só 3 usam `variant="default"` explícito.

**Achado central (origem do "preto vs verde"):** o defaultVariant do Button é **`default` (preto)**. Como quase ninguém usa `default` de propósito, todo botão que **omite** a variante e devia ser CTA sai **preto** por acidente, ao lado de um irmão `brand` verde. Não há lógica cor→hierarquia; é esquecimento de prop.

### Mix concreto na mesma tela
- **`pages/cliente/ClienteProjetoDetail.tsx`** — usa `variant="default"` (preto) **e** `variant="brand"` (verde) no mesmo arquivo. Único caso de mistura preto+verde explícita; nos demais o preto entra por omissão de prop.
- **10 arquivos** combinam `brand` (verde, ação positiva) + `destructive` (vermelho, ação perigosa) — esse par é legítimo (confirmar vs excluir). Lista: `components/admin/UsersAccessManager.tsx`, `components/asaas/AsaasConfigForm.tsx`, `pages/leads/components/LeadActionDialogs.tsx`, `pages/financeiro/tabs/Despesas.tsx`, `pages/financeiro/tabs/Receitas.tsx`, `pages/obras/components/ObraDiarioTab.tsx`, `ObraEstoqueTab.tsx`, `ObraContaTab.tsx`, `ObraCotacoesTab.tsx`, `CotacaoDetailDialog.tsx`.

### Admin (foco pedido) — `pages/admin`, `components/admin`, `pages/ultra-admin`
```
43  outline    ← domina; admin é quase todo botão de contorno
 8  secondary
 5  brand
 2  ghost
 1  destructive
```
Admin praticamente **não usa CTA verde** (5 brand contra 43 outline). Coerente internamente, mas destoa do resto do app (onde brand é o primário). Um form de admin com um único `brand` no meio de outlines é o tipo de "verde solto" que chama atenção.

### Altura custom (bypass dos tokens de size)
**52 arquivos** dão `<Button className="h-6|h-7|h-8|h-12|h-14|h-16 …">`, furando os tamanhos oficiais (h-9/h-10/h-11). Ex.: `components/LinksEditor.tsx`, `ImpersonationBanner.tsx`, `OnboardingChecklist.tsx`, `pages/projetos/components/ProjetosFilterBar.tsx`, `QuickAddCard.tsx`, `KanbanBoard.tsx`, `DisciplinasTableView.tsx`, `EscopoTab.tsx`, `ProjectBudgetTab.tsx`, `pages/portal/PortalFinanceiro.tsx`, `PortalContaObra.tsx`, `pages/meu-trabalho/components/QuadroTrabalho.tsx`, `ListaTrabalho.tsx`, `pages/Relatorios.tsx`, `pages/landing/components/MockupTablet.tsx`. → alturas de botão variam tela a tela.

---

## 3. Cores hardcoded (fora dos tokens)

**Total: 1.544 ocorrências** de classe crua `(bg|text|border|ring|fill|stroke|from|to|via)-(red|green|blue|amber|…)-NNN` em `.tsx`.

### Top ofensores (arquivo : nº de ocorrências)
| Arquivo | Qtd | Intenção que a cor expressa | Token/semântica correta |
|---|---|---|---|
| `pages/landing/components/MockupTablet.tsx` | **193** | mockup ilustrativo da UI (fake screenshots) | caso especial: é arte da landing, não UI de produto. Isolar/ignorar. |
| `pages/projetos/components/DisciplinasSection.tsx` | 37 | status/progresso de disciplina | `bg-*-soft`/`text-*-strong` via `statusBadgeClasses` |
| `pages/propostas/components/PropostaDetailDialog.tsx` | 30 | status da proposta (rascunho/enviada/aceita) | registry `proposta` + `TONE_BADGE` |
| `pages/projetos/components/CronogramaTab.tsx` | 24 | estado de tarefa/prazo (atrasado/ok) | `warning`/`danger`/`success` tokens |
| `components/settings/panels/PagamentoPanel.tsx` | 23 | estado de fatura/plano (pago/pendente/vencido) | `success`/`warning`/`danger` |
| `pages/projetos/components/DisciplinasTab.tsx` | 22 | status de disciplina | registry + `TONE_BADGE` |
| `pages/projetos/components/CronogramaProjetosTab.tsx` | 19 | atraso/adiantado no Gantt | `warning`/`danger`/`info` |
| `pages/checkout/components/CheckoutForm.tsx` | 19 | validação/estado de pagamento | `danger`/`success` |
| `pages/pessoas/components/PessoaFormDialog.tsx` | 18 | tipo de contrato/status pessoa | `CONTRACT_TYPE_COLORS` (que também precisa tokenizar) |
| `pages/rentabilidade/index.tsx` + `financeiro/tabs/Rentabilidade.tsx` | 17+17 | lucro/prejuízo (verde/vermelho) | `text-positive-strong`/`text-negative-strong` |
| `pages/checkout/index.tsx` | 17 | passos/estado do checkout | `info`/`success` |
| `pages/portal/PendenciasCard.tsx` | 16 | pendência/urgência | `warning`/`danger` |
| `pages/cliente/ClienteDashboard.tsx` | 15 | **status de projeto (mapa próprio!)** | **contradiz registry** — ver §6 |
| `pages/financeiro/components/LancamentoFormDialog.tsx` | 15 | receita/despesa | `tipo` registry (`positive`/`danger`) |

### Mapa de intenção → token (as 6 intenções que a paleta crua está tentando dizer)
| Cor crua frequente | Intenção | Token correto |
|---|---|---|
| `bg-green-100 text-green-800` / `text-green-700` | sucesso / pago / recebido / lucro | `bg-success-soft text-success-strong` ou `bg-positive/10 text-positive-strong` |
| `bg-red-100 text-red-800` / `text-red-700` | erro / vencido / prejuízo / atrasado | `bg-danger-soft text-danger-strong` ou `text-negative-strong` |
| `bg-amber-100`/`bg-yellow-100 text-amber-700` | alerta / pendente / em revisão | `bg-warning-soft text-warning-strong` |
| `bg-blue-100 text-blue-700` | info / em andamento / neutro-ativo | `bg-info-soft text-info-strong` |
| `bg-orange-100 text-orange-700` | atenção / projeto ativo | `bg-attention-soft text-attention-strong` |
| `bg-purple-100 text-purple-700` | destaque / lead / revisão | `bg-highlight-soft text-highlight-strong` |
| `bg-gray-100 text-gray-700` | neutro / inativo / cancelado | `bg-muted text-muted-foreground` |

Confirmado: **todos os tokens semânticos existem** (`tokens.css:190-235`, expostos em `tailwind.config.ts:111-152`). Nenhuma cor crua acima é "necessária por falta de token".

---

## 4. Elementos nativos vazando

### `<select>` nativo (regra do projeto: sempre shadcn Select — ver memória "Nunca dropdown nativo do SO")
- `pages/financeiro/tabs/Despesas.tsx:415`
- `pages/financeiro/tabs/Metas.tsx:261`
- `pages/financeiro/tabs/Metas.tsx:335`
- `pages/clientes/ClienteFormDialog.tsx:667`
(4 ocorrências reais em 3 arquivos; `components/filters/CalendarCaption.tsx:27` é só comentário.)

### `type="checkbox"` nativo (regra: shadcn Checkbox)
- `pages/financeiro/tabs/Despesas.tsx:411` — `className="h-4 w-4 rounded border-gray-300"` (estilo cru, destoa do Checkbox tokenizado)
- `pages/financeiro/components/LancamentosTable.tsx:412`
- `pages/metas/components/MetaFormDialog.tsx:313`

### `<input>` raw fora de `ui/` (legítimos vs suspeitos)
Legítimos (`type="file"` escondido / honeypot / teste): `components/forms/Honeypot.tsx:17`, `EntregaveisTab.tsx:719`, `ImportarLancamentosDialog.tsx:252`, `CotacaoDetailDialog.tsx:714`, `PageHeader.test.tsx:79`.
A revisar (deviam ser `<Input>`): `components/PageHeader.tsx:113`, `components/MfaSetup.tsx:71`, `pages/MfaSetupPage.tsx:67`, `pages/inicio/index.tsx:241`, `pages/propostas/index.tsx:908` e `:921`, além do checkbox de Despesas acima.

### `<button>` nativo — ~200 ocorrências (fora de `ui/`)
Aqui o número bruto engana: a **maioria é legítima** (célula clicável de calendário, item de nav da sidebar, card clicável, trigger de tab custom, linha de tabela). Não são "botões que deviam ser `<Button>`". Focos onde um `<button>` **reimplementa um botão de ação com estilo cru** (esses sim são desvio):
- `pages/landing/components/FeaturesSection.tsx:92` — `className="px-4 py-2 rounded-full bg-ink-soft text-white text-xs"` (botão pintado à mão)
- `pages/financeiro/components/LancamentosFilterBar.tsx:491` — chip removível `rounded-full hover:bg-brand/20` (padrão de chip, mas cru)
- `pages/planos/components/CycleToggle.tsx:18,30` — toggle pintado à mão
- Clusters de `<button>` cru com muita repetição de estilo: `pages/chat/index.tsx` (7×), `pages/obras/components/ObraCronogramaTab.tsx` (9×), `pages/meu-trabalho/components/ListaTrabalho.tsx` (5×), `pages/projetos/components/MapaTab.tsx` (7×) — vale auditar caso a caso se há CTA disfarçado de `<button>`.

---

## 5. Espaçamento / altura / raio

- **Altura de botão**: token oficial h-9/h-10/h-11, mas **52 arquivos** sobrescrevem com h-6/7/8/12+ (ver §2). Sem padrão estável.
- **Altura de input/select**: consistente (h-10 fixo na base, poucos overrides).
- **Raio**: coerente **por tipo** de componente (button=full, input/select=md, card=lg, checkbox=sm). Não há botão redondo vs quadrado misturado *dentro* de `<Button>` — o `rounded-full` é global. Onde aparece divergência de raio é em `<button>`/`<div>` nativos pintados à mão (§4), não no componente.
- **Chips redondos ad-hoc**: `rounded-full` reaparece à mão em chips de filtro (`LancamentosFilterBar.tsx:491`), badges de mockup, toggles — cada um com padding próprio (`px-2 py-0.5`, `px-4 py-2`, `p-0.5`). Sem um componente Chip único.
- **Gaps/padding**: Card tem `p-6` padrão, mas dialogs e seções usam `p-3/p-4/p-5/gap-2/gap-3/gap-4` ad-hoc por arquivo. Não há escala de espaçamento nomeada consumida no app (só `--space-section*` para landing).

---

## 6. Feedback de status / badge — o pior foco de inconsistência

**Existe um mapa central** (`src/lib/status.ts` + `TONE_BADGE`), e `src/constants/index.ts` deriva dele para projeto/financeiro (linhas 15-20). **Mas ~14 arquivos ignoram o registry e inventam o próprio mapa de cor de status**, alguns **contradizendo** a cor canônica:

### Contradição direta (mesmo status, cor diferente)
- **`pages/cliente/ClienteDashboard.tsx:14-20`** define um `STATUS_COLORS` próprio para status de projeto:
  - `Planejamento: "bg-blue-100 text-blue-800"` — mas o registry diz Planejamento = **`warning` (amber)** (`lib/status.ts:71`).
  - `Revisão: "bg-purple-100"`, `Paralisado: "bg-yellow-100"`, `Concluído: "bg-gray-100"`, `Cancelado: "bg-red-100"`.
  → O **mesmo status de projeto tem cor diferente no portal do cliente vs no app interno**. Pior tipo de inconsistência (o cliente vê outra cor que o dono).

- **`pages/financeiro/components/faturaHelpers.tsx:24-31`** (`getStatusBadge`) mistura tokenizado + cru na MESMA função:
  - `Paga` → `bg-positive/10 text-positive-strong` ✅ (token)
  - `Vencida` → `bg-red-100 text-red-800` ❌ (cru; devia ser `danger`)
  - `Parcial` → `bg-yellow-100 text-yellow-800` ❌ (`warning`)
  - `Fechada` → `bg-blue-100 text-blue-800` ❌ (`info`)
  - `Aberta` → `bg-gray-100 text-gray-800` ❌ (`neutral`)

### Mapas de status locais que reinventam a roda
Arquivos com função/objeto `getStatus*`/`statusColors`/`STATUS_COLORS` próprios (deveriam consumir `statusBadgeClasses`):
`pages/Relatorios.tsx`, `pages/mapa/MapCanvas.tsx`, `pages/leads/index.tsx`, `pages/inicio/components/ProjectRow.tsx`, `pages/leads/components/LeadDetailDialog.tsx`, `pages/projetos/components/BurnRateChart.tsx`, `DisciplinasTab.tsx`, `ProjetosMobileList.tsx`, `ProjectDetailDialog.tsx`, `ProjetoStatusDialogs.tsx`, `pages/projetos/hooks/useProjetoStatusMove.ts`, `pages/cliente/ClienteDashboard.tsx`, `pages/financeiro/components/faturaHelpers.tsx` (+ `FaturaDetailDialog.tsx`, `FaturasCartaoTable.tsx`), `pages/company/components/CompanyDataTab.tsx`, `CompanySummaryCard.tsx`.

### Constants meio-tokenizado
Mesmo o `constants/index.ts` canônico tem mapas **hardcoded** que ainda não migraram:
- `PROJECT_PRIORITY_CONFIG` (linhas 61-84): `text-red-700`, `bg-amber-50`, `text-blue-700` cru (só `dotColor` usa token `bg-negative`/`bg-chart-*`).
- `CONTRACT_TYPE_COLORS` (134-140): `bg-blue-100`, `bg-purple-100`, `bg-amber-100`, `bg-gray-100` cru (só Estagiário usa `bg-positive/10`).
- `PESSOA_STATUS_COLORS` (157-161): `bg-gray-100`, `bg-yellow-100` cru.

**24 `<Badge>`** recebem className com cor crua da paleta (badges "à mão"). Enquanto o `Badge` não expor variantes `success/warning/info/attention/highlight`, cada tela vai continuar colando `bg-*-100 text-*-800` na mão.

---

## Padrões canônicos do produto (reutilizar)
- **Cor de status/badge** → `statusBadgeClasses(dominio, status)` + `TONE_BADGE` (`src/lib/status.ts`). Nunca `bg-*-100` cru.
- **Cor de valor monetário** → `text-positive-strong` / `text-negative-strong` (WCAG AA garantido, `tokens.css:155-159`).
- **Cor semântica de superfície** → família `*-soft`/`*-strong` (`success`/`danger`/`warning`/`info`/`attention`/`highlight`).
- **Botão** → `<Button variant size>`; CTA = `variant="brand"` (verde), perigoso = `destructive`, secundário = `outline`/`ghost`.
- **Config de status de projeto** → `PROJECT_STATUS_CONFIG` (`constants/index.ts`, já derivado do registry).

## Inconsistências / dívida de UX (por impacto)
- 🔴 **Badge sem variante de status** (componente base) → força TODA tela a inventar cor. Root cause do §6. Afeta ~24+ pontos de render.
- 🔴 **defaultVariant do Button = preto** → CTAs sem `variant="brand"` saem pretos por acidente. Origem do "preto vs verde". Afeta qualquer `<Button>` sem prop.
- 🔴 **`ClienteDashboard.tsx:14-20` contradiz o registry** → status de projeto com cor diferente para o cliente.
- 🟠 **1.544 cores cruas** (excluindo MockupTablet=193, ~1.351 em produto real) com token equivalente existente.
- 🟠 **~14 mapas de status locais** reinventando `lib/status.ts`; `faturaHelpers.tsx` mistura token+cru na mesma função.
- 🟡 **52 arquivos** com altura de botão custom (h-6/7/8/12) furando size tokens.
- 🟡 **constants/index.ts** ainda meio-hardcoded (PRIORITY/CONTRACT/PESSOA colors).
- 🟡 **4 `<select>` + 3 checkbox nativos** violando a regra "sempre custom".

## Lacunas vs. boas práticas
- **Badge não tem variantes semânticas** (o mapa `TONE_BADGE` existe mas não está ligado ao componente `Badge`).
- **Input não tem estado de erro** embutido (cada form pinta borda vermelha à mão).
- **Não há componente Chip/Tag** único → chips redondos ad-hoc com padding próprio.
- **Não há escala de espaçamento nomeada** consumida no app (só landing tem `--space-section*`).
- **Nenhum lint/gate** que bloqueie cor crua da paleta (não há regra Tailwind/ESLint proibindo `bg-green-100`), então a dívida cresce sem barreira.

---

### O que ficou de fora deste scan
- Estados de loading/vazio/erro (skeletons, empty states) — não auditados aqui, foco foi cor/átomo.
- `MockupTablet.tsx` (193 cores cruas) tratado como arte de landing, não UI de produto.
- Contagem de `<button>` nativo (~200) não classificada linha-a-linha entre "legítimo" e "CTA disfarçado"; só clusters apontados.
- Dark mode: tokens têm overrides (`tokens.css:296-299`) mas cobertura em telas não foi verificada.
