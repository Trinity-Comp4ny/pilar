# Catálogo de padrões UI — Pilar

_Gerado em 2026-07-25. Fonte: repo pilar, branch `feat/header-padrao` (2a377f8). Foco: reaproveitamento e deriva, para dirigir a spec do design system._

## Stack de UI

- React 18 + TypeScript + Vite, shadcn/ui (Radix + CVA) em `src/components/ui/` (53 componentes), Tailwind com tokens semânticos em `src/styles/tokens.css` (fonte única de cor), `tailwind.config.ts`, ícones lucide-react, toasts via `useToast`/sonner.
- Regra de marca: verde só como fundo com `text-ink`; estado ativo = `bg-brand text-ink`; nunca `text-brand` sobre fundo claro.

## 1. Inventário: componentes compartilhados vs reimplementação

| Componente                                                    | Onde                                                          | Adoção real                                          | Reimplementado na mão                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Button` (CVA, 7 variants incl. `orange` = bg-brand text-ink) | `src/components/ui/button.tsx:21`                             | Uso amplo                                            | **variant `orange` tem 0 usos**; 105 `<Button className="bg-brand...">` re-estilizam na mão                                |
| `Badge` (4 variants)                                          | `src/components/ui/badge.tsx`                                 | Uso amplo, mas sempre via `className` com mapa local | 6+ mapas de status locais; 15 spans badge-like sem o componente                                                            |
| `PageHeader` (spec 002: busca + ação primária gated)          | `src/components/PageHeader.tsx`                               | 21 páginas                                           | Financeiro, chat, início, mapa, portal ainda fora                                                                          |
| `PageLayout`                                                  | `src/components/PageLayout.tsx`                               | 21 páginas                                           | Mesmos módulos fora                                                                                                        |
| `EmptyState`                                                  | `src/components/EmptyState.tsx`                               | 13 arquivos                                          | ~80 arquivos com "Nenhum..." ad-hoc (nem todos são empty state, mas a maioria dos vazios de tabela é div solta)            |
| `ConfirmDialog`                                               | `src/components/ConfirmDialog.tsx`                            | 27 arquivos                                          | 19 arquivos montam `AlertDialogContent` cru (Contas, Metas, PagamentosTab, CategoryManager...)                             |
| `KPICard` (dashboard)                                         | `src/pages/dashboard/components/KPICard.tsx`                  | **1 import** (Dashboard.tsx)                         | 2º `KPICard` local com API diferente em `src/pages/financeiro/tabs/Lancamentos.tsx:171`; ~17 cards de número grande ad-hoc |
| `TableSkeleton` / `PageSkeleton`                              | `src/components/`                                             | **2 usos**                                           | 155 `animate-spin` ad-hoc (79 arquivos em pages); 12 textos "Carregando..."                                                |
| `ui/skeleton`                                                 | `src/components/ui/skeleton.tsx`                              | 24 arquivos                                          | Convive com spinner ad-hoc na mesma tela                                                                                   |
| `ui/table`                                                    | `src/components/ui/table.tsx`                                 | 28 arquivos                                          | 7 arquivos com `<table>` cru (`LancamentosTable.tsx:468`, DisciplinasTab, capacidade...)                                   |
| `Can` / `usePermissions.getButtonProps`                       | `src/components/Can.tsx`                                      | PageHeader já gateia a primária                      | Ações fora do header nem sempre gateadas                                                                                   |
| Formatadores (`lib/`)                                         | `utils.ts`, `currency.ts`, `currencyUtils.ts`, `dateUtils.ts` | Parcial                                              | **3 formatadores de moeda concorrentes no próprio lib/** + 26 redefinições locais                                          |

## 2. As 10 derivas mais caras

Ordenadas por (nº de duplicações × custo de manutenção). Contagens por grep no estado atual da branch.

### D1. Botão primário de marca re-estilizado na mão (105 ocorrências)

`Button` já tem `variant="orange"` (`ui/button.tsx:21`, `bg-brand text-ink hover:bg-brand/90`) com **zero usos**. Em vez disso, 105 `<Button>` repetem a classe:

- `src/pages/leads/components/LeadFormDialog.tsx:323` (`className="flex-1 bg-brand hover:bg-brand/90 text-ink"`)
- `src/pages/pessoas/components/PessoaFormDialog.tsx:847` e `:856`
- `src/pages/projetos/components/ProjetoFormDialog.tsx:664`, `QuickAddCard.tsx:120`, `ManageDisciplinasDialog.tsx:89` e `:163`, `FluxoDisciplinasDialog.tsx:463`
- `src/pages/propostas/index.tsx:1194`, `GerarPropostaDialog.tsx:504` e `:539`, `TemplatesManager.tsx:379`
- `src/components/PageHeader.tsx:127` (o próprio header padronizado repete a classe com `hover:bg-brand/85`, divergindo do `/90`)
- `src/components/admin/UsersAccessManager.tsx:102`, `src/pages/metas/tabs/MetasProjetos.tsx:321` e `:348`, MetasPessoais, FolhaDialogs (3x), FinanceItemForm (2x)...

Custo: mudar o botão de marca hoje = editar 105 pontos. Hovers já divergem (`/85` vs `/90`).

### D2. Formatação de moeda quadruplicada (3 no lib + 26 locais + 42 inline)

Três fontes concorrentes no próprio `lib/`:

- `src/lib/utils.ts:23` (`formatCurrency`, 2 casas)
- `src/lib/currencyUtils.ts:8` (`formatCurrency`, idêntica, duplicada)
- `src/lib/currency.ts:1` (`formatBRL`, **0 casas decimais**, comportamento diferente)

Mais 26 redefinições locais (`formatBRL`/`formatCurrency` por arquivo): `financeiro/tabs/Lancamentos.tsx:28`, `Faturas.tsx:22`, `VisaoGeral.tsx:35`, `FluxoCaixa.tsx:27`, `ResumoMensal.tsx:66`, `LancamentosTable.tsx:50`, `LancamentosItemRow.tsx:36`, `LancamentosGroupRow.tsx:83`, `LancamentoDetailDialog.tsx:21`, `propostas/index.tsx:371`, `PropostaDetailDialog.tsx:68`, `clientes/[id]/index.tsx:64`, `portal/PortalFinanceiro.tsx:9`, `BurnRateChart.tsx:22`, `MapaTab.tsx:43`, `BudgetActualCard.tsx:29`, `SmartInvoiceDialog.tsx:55`... E 42 `style: "currency"` inline em 41 arquivos. Total: ~70 pontos de manutenção para "como o Pilar mostra dinheiro". Num produto cuja tagline é lucro por projeto, moeda inconsistente (0 vs 2 casas) é deriva de credibilidade.

### D3. Mapas de status locais por página (6+ mapas, cores divergentes para o mesmo conceito)

- `src/constants/index.ts:13` `PROJECT_STATUS_CONFIG` (cores hardcoded `bg-yellow-100 text-yellow-800` misturadas com tokens `bg-status-done/10`)
- `src/hooks/usePropostas.ts:56` `PROPOSTA_STATUS_CONFIG` (hardcoded `bg-gray-100`, `bg-blue-100` misturado com token `bg-positive/10`)
- `src/pages/leads/index.tsx:37` `statusConfig` (todo em tokens `bg-info-soft text-info-strong`) + `:47` `STATUS_DOT` (segundo mapa paralelo na mesma página)
- `src/pages/Relatorios.tsx:36` `statusConfig` (hardcoded `bg-amber-100 text-amber-800 border-amber-200`) + `:45` `tipoConfig`
- Consumidores espalhados: `PessoaTable.tsx`, `PortalEntregas.tsx`, `ProjetoDetailHeader.tsx:32`, `DisciplinasTab.tsx:593`, `KanbanBoard.tsx`, `clientes/[id]/index.tsx:102`...

Mesmo conceito ("Pago"/"Recebido") tem cor emerald hardcoded no Relatorios e token `positive` no financeiro. "Pendente" é amber num lugar, yellow noutro.

### D4. Estados de loading: spinner ad-hoc em vez de skeleton (155 ocorrências)

`TableSkeleton`/`PageSkeleton` existem e têm **2 usos**. Contra isso: 155 `animate-spin` (79 arquivos só em pages) e 12 "Carregando...". `ui/skeleton` é usado em 24 arquivos, então o padrão bom existe mas não venceu. Cada tela decide sozinha entre spinner central, texto e skeleton.

### D5. Cores cruas do Tailwind furando os tokens (177 ocorrências em 52 arquivos)

`tokens.css` declara "PRIMITIVES: nunca usar direto" e oferece `surface-*-soft`/`text-*-strong` com contraste WCAG medido (`tokens.css:181-235`). Mesmo assim há 177 usos de `amber-100`/`emerald-100`/`red-100`/`blue-100`/`yellow-100`/`purple-100` em 52 arquivos (ex.: `Relatorios.tsx:36-47`, `constants/index.ts:16-36`, `usePropostas.ts:57-61`, `Lancamentos.tsx:183-185`). Consequência: dark mode e ajustes de contraste não propagam.

### D6. KPICard: dois componentes com o mesmo nome e APIs diferentes + ~17 cards ad-hoc

- `src/pages/dashboard/components/KPICard.tsx` (API: `title/value/cardBg/titleColor/valueColor/subtitleColor/variacao`), importado só pelo Dashboard.
- `src/pages/financeiro/tabs/Lancamentos.tsx:171` (API: `label/value/icon/tone/loading`), local, com skeleton embutido (a melhor implementação, aliás).
- Ad-hoc: `VisaoGeral.tsx:43-50` (4 cards), `FolhaSummaryCards.tsx:18-38` (3), `DisciplinasTab.tsx:295-334` (5, com `text-blue-700`/`text-yellow-600` cru), `MetasDashboard.tsx:100`, `CartaoDetailPanel.tsx:50`, `ContaDetailPanel.tsx:52`.

### D7. Confirmação destrutiva: ConfirmDialog vs AlertDialog cru (27 vs 19 arquivos)

19 arquivos montam a estrutura `AlertDialogContent` inteira na mão: `financeiro/tabs/Contas.tsx`, `Metas.tsx`, `CategoryManager.tsx`, `SupplierManager.tsx`, `FinanceItemForm.tsx`, `projetos/components/PagamentosTab.tsx`, `DisciplinasTableView.tsx`, `ProjetoFormDialog.tsx`, `ProjetoStatusDialogs.tsx`, `metas/tabs/*` (3), `clientes/[id]/index.tsx`, `company/components/CompanyDialogs.tsx`... Copy e estilo do botão destrutivo variam por cópia.

### D8. Formatação de data duplicada (17+ defs locais, timezone tratado a cada vez)

`lib/dateUtils.ts` tem `formatDate`/`formatDateShort`/`formatDateDisplay` com o fix de timezone (`+ "T00:00:00"`). Ainda assim, 17+ redefinições locais copiam o mesmo one-liner: `portal/PortalFinanceiro.tsx:11`, `PortalTimeline.tsx:18`, `PagamentosTab.tsx:83`, `BillingMilestonesTab.tsx:144`, `MapaTab.tsx:47`, `CronogramaTab.tsx:98`, `CronogramaProjetosTab.tsx:132`, `propostas/index.tsx:374`, `PropostaDetailDialog.tsx:71`, `clientes/[id]/index.tsx:67`, `ClienteDashboard.tsx:28`, `billing/index.tsx:19`... Mais 49 `toLocaleDateString` inline fora do dateUtils. Quem esquecer o `T00:00:00` reintroduz o bug de fuso já corrigido.

### D9. Inputs de busca ad-hoc remanescentes (6 reais após o PageHeader)

O PageHeader (spec 002) absorveu a busca de 21 páginas. Sobram buscas com ícone reimplementadas em contexto de tabela/filtro local: `pessoas/components/PessoaTable.tsx:134`, `ultra-admin/index.tsx:589`, `financeiro/tabs/Despesas.tsx:518`, `Receitas.tsx:475`, `financeiro/components/LancamentosFilterBar.tsx:132`, `projetos/components/DisciplinasTab.tsx:347`. (CommandInput em MapaTab/LancarHorasDialog é legítimo, é outro componente.)

### D10. Classe morta `vrz-card` (13 arquivos)

`vrz-card` é aplicada em 13 arquivos (`KPICard.tsx`, `HealthIndexCard.tsx`, `financeiro/tabs/VisaoGeral.tsx:43`, `Contas.tsx`, `Faturas.tsx`, `FluxoCaixa.tsx`, `ResumoMensal.tsx`, `Metas.tsx`, `MetasSummary.tsx`, `metas/tabs/*` 4x) e **não está definida em nenhum CSS nem no tailwind.config**. É ruído de tema legado (VRZ): confunde leitura e sugere um estilo que não existe. Remover ou definir de propósito.

## 3. Promover a componente compartilhado (máx. 8, por impacto)

| #   | Componente proposto                                                                | API mínima                                                                                                                                                                | Extrair de                                                                                                                                                         | Substitui                                                     |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | `formatCurrency` único em `src/lib/format.ts` (não é componente, é a maior deriva) | `formatCurrency(v, { decimals? })`, `formatDate(iso)`, `formatDateShort(iso)`                                                                                             | `lib/currencyUtils.ts` + `lib/dateUtils.ts` (já testados); deletar `lib/currency.ts` e o `formatCurrency` de `lib/utils.ts` (re-export com deprecation se preciso) | ~70 pontos de moeda + ~66 de data                             |
| 2   | `StatusBadge`                                                                      | `<StatusBadge domain="projeto\|proposta\|lead\|financeiro" status={s} size?>`; registry único de status em `src/lib/status.ts` (label + tom semântico), tons só em tokens | Mapa de leads (`leads/index.tsx:37`, único 100% em tokens) + estrutura de `constants/index.ts`                                                                     | 6+ mapas locais, ~40 render sites, 177 cores cruas caem junto |
| 3   | `KPICard` compartilhado em `src/components/KPICard.tsx`                            | `label, value (string), icon?, tone? ("positive"\|"negative"\|"warning"\|"neutral"), delta? {value, invert}, loading?, onClick?`                                          | **Versão do Lancamentos** (`Lancamentos.tsx:171`, tem loading embutido) + lógica de variação do dashboard (`dashboard/components/KPICard.tsx:34-46`)               | 2 KPICards + ~17 cards ad-hoc                                 |
| 4   | `SearchInput`                                                                      | `value, onChange, placeholder?, size?`; mesmo visual do PageHeader                                                                                                        | Bloco de busca do `PageHeader.tsx:94-118` (extrair e o PageHeader passa a consumir)                                                                                | 6 buscas ad-hoc + garante consistência futura                 |
| 5   | `ConfirmDialog` (adoção, não criação)                                              | Já existe; adicionar `variant="destructive"` e `loading` se faltar                                                                                                        | `src/components/ConfirmDialog.tsx`                                                                                                                                 | 19 AlertDialog crus                                           |
| 6   | `DataTableShell` (leve: wrapper de Table + estado)                                 | `loading (TableSkeleton), empty (EmptyState props), children`                                                                                                             | `ui/table` + `TableSkeleton` + `EmptyState` compostos; referência de uso: `propostas/index.tsx:618-624`                                                            | Divergência loading/empty das 28 tabelas, sem impor colunas   |
| 7   | `EmptyState` (adoção + inline variant)                                             | Adicionar `variant="table"` (compacto, para dentro de `<TableCell colSpan>`)                                                                                              | `src/components/EmptyState.tsx`                                                                                                                                    | Maioria dos ~80 "Nenhum..." ad-hoc                            |
| 8   | `FormDialogShell`                                                                  | `title, description?, onSubmit, submitLabel, isPending, children`; footer padronizado (cancelar ghost + submit `variant="brand"`)                                         | `LeadFormDialog.tsx` (estrutura mais limpa das 67)                                                                                                                 | Footer/submit copiado em ~30 form dialogs                     |

## 4. Resolver com VARIANT em componente existente (sem componente novo)

| Alvo          | Ação                                                                                                                                                                                                                                  | Elimina                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `Button`      | Renomear `orange` para `brand` (`ui/button.tsx:21`, manter alias `orange` até migrar) e **migrar os 105 `className="bg-brand..."` para `variant="brand"`**; PageHeader (`PageHeader.tsx:127`) usa a variant e some o `/85` divergente | D1 inteira via codemod/grep, sem componente novo |
| `Badge`       | Adicionar variants semânticas `success\|danger\|warning\|info\|attention\|highlight\|brand` mapeadas nos tokens `surface-*-soft`/`text-*-strong`; `StatusBadge` (item 3.2) vira wrapper fino disso                                    | Metade de D3 e D5                                |
| `Button` size | Adicionar size `xs` (h-7/h-8) usada hoje via className em QuickAddCard, RelatoriosRentabilidade etc.                                                                                                                                  | Alturas ad-hoc                                   |
| `Skeleton`    | Manter; a padronização é regra de uso (skeleton para conteúdo, spinner só em ação de botão) + `DataTableShell`                                                                                                                        | Parte de D4                                      |

## 5. NÃO padronizar agora

| Item                                                                                                | Por quê                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabela "DataTable" completa (colunas declarativas, sort, paginação genérica)                        | 28 tabelas com necessidades distintas (grupos expansíveis em Lancamentos, kanban em projetos); abstração grande antes da hora. O `DataTableShell` leve (loading/empty) já captura 80% do ganho |
| Form engine (react-hook-form + zod em tudo)                                                         | Só 14 arquivos usam `useForm`, 13 `zodResolver`; o resto é useState controlado e funciona. Migrar forms é projeto próprio, não design system                                                   |
| Páginas dormentes (Timesheet, Capacidade, Metas, Templates, WIP, DRE, Aging, Rentabilidade, IA Hub) | Não gastar migração em código dormente; aplicar padrão novo só quando o módulo reativar. Exceção: se o codemod do `variant="brand"` for mecânico, pode passar por tudo                         |
| Landing (`src/pages/landing/`)                                                                      | Linguagem visual própria (marketing), MockupTablet é ilustração; padronizar com o app traz rigidez sem ganho                                                                                   |
| Chat cards (`src/pages/chat/*Card.tsx`)                                                             | Padrão de confirmação do copiloto ainda em evolução (Fase 2 planejada); padronizar agora congela cedo demais                                                                                   |
| Motion/sheen do Button                                                                              | Já centralizado no CVA base; não abrir variants de animação                                                                                                                                    |

## Ordem de ataque sugerida (para a spec)

1. `lib/format.ts` + codemod de moeda/data (maior contagem, risco baixo, testável)
2. `Button variant="brand"` + codemod dos 105 (mecânico)
3. `Badge` variants semânticas + `StatusBadge` + registry de status (mata D3 e boa parte de D5)
4. `KPICard` compartilhado
5. `SearchInput` extraído do PageHeader
6. Adoção: `ConfirmDialog` nos 19, `EmptyState` inline, `DataTableShell`
7. Limpeza: remover `vrz-card` (13 arquivos) e `lib/currency.ts`/`currencyUtils` duplicado

## Números de referência (grep 2026-07-25)

- 105 `<Button>` com `bg-brand` via className; 0 usos de `variant="orange"`
- 3 formatadores de moeda no lib + 26 defs locais + 42 inline (~70 pontos)
- 6+ mapas de status locais; 177 usos de paleta crua em 52 arquivos
- 155 `animate-spin`; 2 usos de TableSkeleton/PageSkeleton; 24 arquivos com ui/skeleton
- 17+ `formatDate` locais + 49 `toLocaleDateString` inline
- 27 arquivos com ConfirmDialog vs 19 com AlertDialog cru
- 21 páginas com PageHeader/PageLayout; financeiro, chat, início, mapa e portal fora
- 6 buscas ad-hoc restantes; 13 arquivos com classe morta `vrz-card`
- 2 componentes chamados `KPICard` com APIs diferentes; ~17 cards de KPI ad-hoc
