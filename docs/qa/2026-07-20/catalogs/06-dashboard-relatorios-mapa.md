# Catálogo QA — Dashboard, Relatórios e Mapa

Módulos read-heavy (agregações, filtros de data, exports). Ambiente: banco LOCAL vazio, app em http://localhost:8080, login `admin@pilar.local` / `Pilar@2026`.

Arquivos no escopo:
- `src/pages/Dashboard.tsx` + `src/hooks/useDashboardData.ts` + `src/hooks/dashboard/{queries,processors}.ts` + `src/hooks/useFinanceChartData.ts` + `src/hooks/useFinanceChartFallback.ts` + `src/components/charts/DashboardFinanceChart.tsx`
- `src/pages/Relatorios.tsx` + `src/pages/relatorios/{useRelatorioData,relatorioExport,relatorioFilters,rentabilidade}.ts` + `RelatoriosRentabilidade.tsx` + `RelatoriosSummary.tsx`
- `src/pages/mapa/{index.tsx,MapCanvas.tsx,constants.ts}`
- util transversal: `src/lib/dateUtils.ts`

**Nota sobre a suspeita histórica ("Dashboard mascara falha de query"):** CONFIRMADO como CORRIGIDO no Dashboard. `useDashboardData.ts:42-45` agora varre todos os resultados do `Promise.all`, pega o primeiro `error` e faz `throw` — o `queryFn` rejeita e a tela mostra o card de erro (`Dashboard.tsx:259-285`), não zeros. **Porém o mesmo padrão NÃO foi aplicado no Mapa** (ver ACH-MAP-01): lá a falha ainda vira "nenhum projeto".

---

## PARTE A — Casos de teste para o browser

| ID | Fluxo | Rota / onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| DASH-01 | Dashboard com banco vazio | `/` (Dashboard) | Login limpo, abrir dashboard sem nenhum projeto/financeiro/lead | Banco 100% vazio | KPIs mostram `R$ 0,00` e `0`; listas mostram empty states ("Nenhum projeto ativo", "Tudo tranquilo por aqui", "Sem vencimentos próximos"); gráfico mostra "Sem dados no período". NÃO deve quebrar nem mostrar erro. | P1 |
| DASH-02 | Dashboard após popular dados | `/` | Criar 2-3 projetos (1 concluído, 2 em andamento), receitas/despesas no mês, 1 lead | — | "Projetos Ativos" conta só "Em andamento" (não planejamento/concluído); Receita/Despesa/Saldo do período batem com o Financeiro; card "A Receber" = soma de receitas Pendente com vencimento dentro do período | P1 |
| DASH-03 | Filtro de período invertido (início > fim) | Dashboard, preset "Personalizado" | Escolher `De` = 31/07, `Até` = 01/07 | from > to | **Provável bug (ACH-DASH-01):** sem guard; queries `gte(from).lte(to)` retornam vazio → todos os KPIs viram `R$ 0,00` sem aviso. Esperado: bloquear ou avisar "período inválido". | P2 |
| DASH-04 | Período futuro | Dashboard, "Personalizado" | `De` = 01/01/2030, `Até` = 31/01/2030 | intervalo sem dados | KPIs zerados + gráfico "Sem dados no período". Aceitável, mas confirmar que não é confundido com falha | P3 |
| DASH-05 | Período gigante | Dashboard, "Este Ano" ou custom de 10 anos | Selecionar range enorme | range de anos | Dados agregam sem travar; gráfico fica fixo nos últimos 12 meses (independe do range escolhido — confirmar se é intencional/confuso) | P2 |
| DASH-06 | Falha de query financeira (silent failure) | Dashboard | Com sessão logada, derrubar RLS/rede numa das queries (ex.: revogar acesso a `receitas` ou cortar conexão e forçar refetch) | query retorna `error` | Tela inteira mostra card de erro "Erro ao carregar dados" / "Sem acesso a estes dados" com botão "Tentar novamente" — NÃO cards com `R$ 0,00`. (Regressão a vigiar) | P0 |
| DASH-07 | Falha só do gráfico (RPC + fallback) | Dashboard, card "Fluxo Financeiro" | Fazer a RPC `get_financial_chart_data` falhar E o fallback falhar | ambos com erro | Card do gráfico mostra "Não foi possível carregar o fluxo financeiro" (isolado); resto do dashboard continua vivo | P2 |
| DASH-08 | Deep-link de período pela URL | `/?from=2026-07-01&to=2026-07-31` | Abrir URL com params; depois `?from=abacaxi&to=` | datas inválidas na query string | Params válidos hidratam o filtro; inválidos caem no default (mês atual) sem quebrar (`parseDateParam`) | P3 |
| DASH-09 | Drill-down dos KPIs | Dashboard → Financeiro | Clicar em card "Receita/Despesa/Saldo/A Receber" | — | Navega para `/financeiro?from=...&to=...` preservando o período | P2 |
| DASH-10 | Permissões (RBAC) | Dashboard com `colab`/`coord` | Logar com colaborador (sem financeiro) | usuário sem módulos | Cards financeiros somem; se nenhum módulo visível → tela "Sem módulos disponíveis" | P2 |
| REL-01 | Gerar relatório sem tipo | `/relatorios` | Clicar "Gerar relatório" sem selecionar tipo | tipo vazio | Toast "Campos obrigatórios / Selecione o tipo" | P2 |
| REL-02 | Relatório sem dado | `/relatorios` | Tipo "Financeiro", período "Mês anterior" num mês vazio | zero registros | Toast "Sem dados / Não foram encontrados dados"; mantém empty state "Nenhum relatório gerado" | P1 |
| REL-03 | Export CSV/PDF (existe?) | `/relatorios` após gerar | Gerar "Financeiro", clicar CSV e depois PDF | — | **Export EXISTE** (CSV nativo + PDF via jsPDF lazy). Baixa só colunas visíveis; linha de total = Saldo (misto) ou Total (tipo único); toast "Exportação iniciada" | P1 |
| REL-04 | Export sem dado | `/relatorios` | Clicar CSV/PDF sem relatório gerado | filteredData vazio | Botões desabilitados; se forçado, toast "Sem dados / Gere um relatório antes de exportar" | P2 |
| REL-05 | CSV injection na descrição | `/relatorios` → CSV | Criar receita com descrição `=1+1` ou `@SUM(A1)` ou `+cmd`, gerar relatório, exportar CSV, abrir no Excel | payload de fórmula em campo de texto | **Bug (ACH-REL-03):** `escapeCSV` só protege vírgula/aspas, não prefixa `= + - @` → fórmula executa no Excel/Sheets. Esperado: sanitizar prefixo | P2 |
| REL-06 | Período "Todos" (full-scan) | `/relatorios` | Tipo "Financeiro", período "Todos" (default), com muitos registros | base grande | Carrega, mas ver ACH-REL-01: busca paginada client-side de TODAS receitas+despesas com joins. Medir tempo/memória com 5k+ linhas | P2 |
| REL-07 | Período custom invertido | `/relatorios`, "Personalizado" | `De` > `Até` | from > to | Busca retorna vazio → toast "Sem dados" (não silencioso, mas não avisa que o range está invertido) | P2 |
| REL-08 | Filtros de coluna encadeados | `/relatorios` após gerar | Aplicar filtro Categoria, depois Cliente, depois Status | combinações | Selects mostram só valores compatíveis; badge "X de Y"; filtros órfãos se autolimpam ao mudar opções | P2 |
| REL-09 | Rentabilidade por projeto/cliente | `/relatorios` | Tipo "Rentabilidade por projeto" e "por cliente" | — | Fluxo próprio (RPC `rpc_dashboard_rentabilidade`); mostra Receita/Custo/Margem/Margem%; agrega por cliente somando e recomputando margem; export CSV/PDF próprios | P1 |
| REL-10 | Rentabilidade sem dado / erro | `/relatorios` | Rentabilidade com banco vazio; depois forçar erro na RPC | vazio / erro | Vazio → empty state "Sem projetos para calcular rentabilidade"; erro → empty state "Não foi possível carregar a rentabilidade" (com mensagem) | P1 |
| REL-11 | Colunas visíveis persistidas | `/relatorios` | Ocultar colunas, recarregar página | localStorage `relatorios.columns` | Seleção persiste; export respeita colunas visíveis; não deixa ocultar a última coluna (size > 1) | P3 |
| REL-12 | Troca de tipo sem regenerar | `/relatorios` | Gerar rentabilidade, depois selecionar "Receitas" sem clicar Gerar | estado intermediário | View ainda mostra rentabilidade até clicar Gerar (inconsistência de estado — verificar se confunde) | P3 |
| REL-13 | Gráfico com <2 meses | `/relatorios` | Gerar relatório com registros de 1 só mês | 1 ponto | Gráfico não renderiza; mostra "Dados insuficientes para gráfico" | P3 |
| MAP-01 | Mapa com banco vazio | `/mapa` | Abrir sem projetos | zero projetos | EmptyState "Nenhum projeto com localização geográfica encontrado" | P1 |
| MAP-02 | Obras sem coordenada | `/mapa` | Criar projetos com endereço mas sem lat/lng (ou lat/lng nulos) | sem coordenada | Banner "N projetos não aparecem no mapa..."; expandível; clicar leva a `/projetos/:id`. Projetos com coord aparecem normalmente | P1 |
| MAP-03 | Coordenada inválida / fora do Brasil | `/mapa` | Projeto com lat/lng = 0/0, ou (48, 2) Paris, ou strings/NaN | coord adversarial | `temCoordenadaValida` trata 0/0 e fora da bbox do Brasil como "sem coordenada" → cai no banner. Projeto internacional legítimo NÃO aparece (ver ACH-MAP-03) | P2 |
| MAP-04 | Marcador clicável | `/mapa` | Clicar num marcador | — | Abre Sheet lateral com código, nome, status, cliente, valor, período, área, endereço + botão "Abrir Projeto" | P1 |
| MAP-05 | Muitas obras (cluster/perf) | `/mapa` | Popular 200+ projetos com coordenadas | volume alto | Clustering (`MarkerClusterGroup chunkedLoading`) agrupa; query SEM `.limit()` traz todos (ver ACH-MAP-02). Medir tempo de fetch/render | P2 |
| MAP-06 | Falha da query do mapa (silent failure) | `/mapa` | Forçar erro na query `projetos-mapa` (RLS/rede) | query com error | **Bug (ACH-MAP-01):** hoje mostra EmptyState "Nenhum projeto..." (mentira). Esperado: estado de erro distinto de "vazio" | P1 |
| MAP-07 | Filtro por status + legenda | `/mapa` | Clicar num status na legenda; clicar de novo | toggle | Filtra marcadores; contador por status atualiza; overlay "Nenhum projeto com este status" quando filtro zera resultado | P2 |
| MAP-08 | Data no Sheet (fuso) | `/mapa` → marcador | Projeto com `data_inicio`/`data_previsao` = ex. 2026-07-15 | data-only string | **Bug (ACH-MAP-04):** `formatDate` usa `new Date("2026-07-15")` (UTC) → em UTC-3 exibe 14/07. Verificar off-by-one | P2 |
| MAP-09 | Busca por projeto/cliente | `/mapa` → "Localizar" | Buscar por código/nome e por cliente | — | Seleciona projeto → voa até o marcador e abre Sheet; cliente → enquadra bounds dos projetos do cliente | P3 |
| MAP-10 | Fullscreen + fit bounds | `/mapa` | Tela cheia; botão centralizar | — | Entra/sai fullscreen; `flyToBounds` enquadra filtrados; sem travar tiles (invalidateSize) | P3 |

---

## PARTE B — Achados estáticos (bugs no código)

### ACH-MAP-01 · 🟠 · silent-failure · `src/pages/mapa/index.tsx:83`
**Cenário:** a query de projetos do mapa falha (RLS, sessão expirada, rede). O `useQuery` NÃO desestrutura `error` — só `{ data: todosOsProjetos = [], isLoading }`. Em falha, `data` fica `undefined` → default `[]` → `projetos.length === 0` → renderiza o EmptyState "Nenhum projeto com localização geográfica encontrado" (`index.tsx:271-276`). O usuário lê "você não tem obras" quando na verdade a carga falhou.
**Evidência:**
```ts
const { data: todosOsProjetos = [], isLoading } = useQuery({
  queryKey: ["projetos-mapa"],
  queryFn: async () => { const { data, error } = await supabase.from("projetos")...; if (error) throw error; ... }
});
```
O `throw error` faz o react-query marcar `isError`, mas a UI nunca lê `isError`/`error`. É exatamente o padrão de "mascarar falha de query" que o Dashboard já corrigiu e o Mapa não. Corrigir: destruturar `error` e renderizar estado de erro com retry.

### ACH-DASH-01 · 🟠 · corretude/data-fuso · `src/pages/Dashboard.tsx:205-228` + `src/hooks/useDashboardData.ts:35-39`
**Cenário:** no preset "Personalizado" os dois calendários (`setDateFrom`, `setDateTo`) são independentes, sem qualquer guard de `from <= to`. Com `from > to`: (a) as queries usam `.gte(startStr).lte(endStr)` (`queries.ts:79-80,87-89`) → retornam vazio → KPIs Receita/Despesa/Saldo/A Receber viram `R$ 0,00` silenciosamente; (b) o cálculo do período anterior quebra: `duracao = differenceInCalendarDays(periodoEnd, periodoStart)` fica negativo, `prevStart = addDays(prevEnd, -duracao)` inverte, tornando a variação % sem sentido.
**Evidência:** nenhuma validação entre `dateFrom`/`dateTo`; `Calendar mode="single"` sem `disabled`/min-max cruzado. Resultado é um número de dinheiro falso (zero) apresentado como verdade.

### ACH-REL-01 · 🟠 · performance/full-scan · `src/pages/relatorios/useRelatorioData.ts:83-154`
**Cenário:** `fetchFinancialData` faz busca paginada (1000/página) em loop de TODAS as linhas de `receitas` e `despesas` com joins (`*, projetos(nome), categorias_financeiras(nome), contas(nome), clientes/fornecedores(nome)`), trazendo tudo para o cliente. O preset default de período é **"Todos"** (`Relatorios.tsx:52-53`), que não aplica filtro de data (`applyPreset` seta `dateFrom/dateTo = undefined`). Então o caminho mais provável (abrir Relatórios, escolher "Financeiro", Gerar) puxa a base financeira inteira sem teto. Toda a agregação (summary, gráfico, filtros) roda em memória no browser.
**Evidência:** `while (true) { ... q.range(page*1000, ...); if (chunk.length < 1000) break; page += 1; }` sem limite de páginas; sem agregação server-side para o caso "Todos". Escala mal com empresas grandes.

### ACH-REL-02 · 🟠 · corretude/silent-failure · `src/pages/relatorios/relatorioExport.ts:36-39` e `src/pages/relatorios/RelatoriosRentabilidade.tsx:160`
**Cenário (CSV injection):** `escapeCSV` só envolve em aspas quando o valor contém `,` ou `"`. Não neutraliza células que começam com `=`, `+`, `-` ou `@`. Como `Descrição`, `Categoria`, nome de projeto/cliente vêm de input do usuário, uma descrição como `=HYPERLINK(...)` ou `+cmd|...` é exportada crua e o Excel/Sheets interpreta como fórmula ao abrir o CSV. Mesma falha no `escape` da rentabilidade (`RelatoriosRentabilidade.tsx:160`).
**Evidência:**
```ts
const escapeCSV = (value) => { const str = ...; return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g,'""')}"` : str; };
```
Falta prefixar com `'` (ou `\t`) valores iniciados por `= + - @`.

### ACH-MAP-04 · 🟡 · data-fuso · `src/pages/mapa/index.tsx:50-53`
**Cenário:** `formatDate(d)` faz `new Date(d).toLocaleDateString("pt-BR")`. Para uma string date-only ("2026-07-15") o JS parseia como meia-noite UTC; em UTC-3 (Brasília) o `toLocaleDateString` exibe o dia anterior (14/07). O Sheet de detalhe do projeto (`Período: data_inicio → data_previsao`, `index.tsx:515-519`) mostra datas um dia atrás.
**Evidência:**
```ts
function formatDate(d) { if (!d) return null; return new Date(d).toLocaleDateString("pt-BR"); }
```
Contraste com `src/lib/dateUtils.ts:65-68` (`formatDate`) que corrige adicionando `"T00:00:00"`. O mapa reimplementa sem a correção.

### ACH-REL-03 · 🟡 · estado · `src/pages/Relatorios.tsx:543-551` + `handleGerarRelatorio:228-237`
**Cenário:** depois de gerar um relatório de Rentabilidade (`rentabilidadeMode` setado), se o usuário troca o "Tipo" para "Receitas" mas NÃO clica "Gerar", a tela continua exibindo o componente de Rentabilidade (a condição `rentabilidadeMode ?` vence). O estado visível diverge do seletor. Só reconcilia ao clicar Gerar (que faz `setRentabilidadeMode(null)`).
**Evidência:** `rentabilidadeMode` só é limpo dentro de `handleGerarRelatorio`, não no `onValueChange` do Select de tipo.

### ACH-MAP-02 · 🟡 · performance · `src/pages/mapa/index.tsx:86-91`
**Cenário:** a query do mapa não tem `.limit()` nem paginação — busca todos os projetos não deletados com join de cliente. Com centenas/milhares de obras, todo o payload vem de uma vez. O clustering ajuda no render, mas o fetch e o processamento (`useMemo` de com/sem coordenada, agrupamento por cliente) são O(n) no cliente a cada mudança.
**Evidência:** `supabase.from("projetos").select("id, nome, ...").is("deleted_at", null)` sem teto. Aceitável no estágio atual (poucas obras), mas vira gargalo em escala.

### ACH-MAP-03 · ⚪ · corretude · `src/pages/mapa/constants.ts:76-93`
**Cenário:** `temCoordenadaValida` só aceita coordenadas dentro da bounding box do Brasil (lat −34..5, lng −74..−34). Um projeto legítimo fora do Brasil (obra internacional) é classificado como "sem coordenada" e cai no banner, nunca aparecendo no mapa, mesmo com lat/lng válidos. Decisão consciente (comentário cita 0/0 no Golfo da Guiné), mas é um falso-negativo silencioso para o ICP que atua fora do país.
**Evidência:** limites `BR_LAT_MIN/MAX`, `BR_LNG_MIN/MAX` hardcoded.

### ACH-DASH-02 · ⚪ · estado/UX · `src/pages/Dashboard.tsx:162-164` + `queries.ts:117-141`
**Cenário:** dois eixos temporais coexistem sem sinalização. O gráfico "Fluxo Financeiro" é sempre ancorado nos últimos 12 meses (`chartInicio/chartFim` derivados de `todayKey`), e "Próximos Vencimentos" é fixo em `now`..`now+30d` — nenhum dos dois respeita o filtro de período do topo da página. Um usuário que filtra "Este Ano" e olha o gráfico/vencimentos pode achar que estão filtrados quando não estão.
**Evidência:** `chartInicio = startOfMonth(subMonths(parseISO(todayKey), 11))`; `proximasReceitas/Despesas` usam `format(now)`..`format(addDays(now,30))`, ignorando `mesAtualStart/End`.

### ACH-DASH-03 · ⚪ · silent-failure(menor) · `src/pages/Dashboard.tsx:298` + `useFinanceChartFallback.ts`
**Cenário:** `chartData = chartDataRpc?.length>0 ? chartDataRpc : chartDataFallback ?? []`. Se a RPC do gráfico responde com sucesso porém vazio (sem erro), o fallback não dispara (`enabled` depende de `chartRpcError`). Fica `[]` → o chart mostra "Sem dados no período". Correto quando realmente não há dados, mas se a RPC agregada tiver um bug que retorne vazio sem erro (ex.: filtro de empresa errado), a tela diz "sem dados" em vez de sinalizar problema. Baixo risco, mas é um ponto cego (só o caso erro-real é tratado como falha).

---

## Resumo

- **Parte A:** 33 casos de teste (DASH-01..10, REL-01..13, MAP-01..10).
- **Parte B — achados por severidade:** 🔴 0 · 🟠 3 · 🟡 3 · ⚪ 3 (total 9).
- **Confirmação da suspeita histórica:** o silent-failure de agregação foi CORRIGIDO no Dashboard (`useDashboardData.ts:44-45` faz `throw firstError`), mas SOBREVIVE no Mapa (ACH-MAP-01).

**Top 3 mais graves:**
1. **ACH-MAP-01** (🟠 silent-failure): falha da query do Mapa vira "Nenhum projeto com localização" em vez de erro — `mapa/index.tsx:83` não lê `error`.
2. **ACH-DASH-01** (🟠 corretude): filtro de período sem guard `from <= to`; range invertido zera todos os KPIs de dinheiro silenciosamente — `Dashboard.tsx:205-228`.
3. **ACH-REL-01** (🟠 performance): relatório "Financeiro"/"Todos" (default) faz full-scan paginado client-side de toda a base financeira com joins — `useRelatorioData.ts:83-154`.
