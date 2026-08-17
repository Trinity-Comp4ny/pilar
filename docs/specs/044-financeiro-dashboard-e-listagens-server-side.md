# SPEC: Dashboard financeiro e listagens de Despesas/Receitas server-side

**Data:** 2026-08-17
**Status:** Draft
**Autor:** Claude (a partir do achado do estudo de arquitetura de 2026-08-17)
**Módulo:** financeiro

## Problema

`useFinanceData` (dashboard/Visão Geral) e `useFinanceItems` (abas Despesas/Receitas)
trazem a tabela inteira de `receitas`/`despesas` pro navegador e fazem toda a
agregação (soma, crescimento %, bucket de gráfico, categoria, top 5, filtro, ordenação)
em JavaScript. Em "todo o período" (spec 024), `useFinanceData` não tem NENHUM limite
de linhas — cresce sem teto com o histórico da empresa. `useFinanceItems` já tem um
teto de segurança (2000 linhas, ACH-FIN-07) mas paga o preço trocado: acima do teto a
tela trunca silenciosamente (o usuário não vê tudo, só um aviso interno via
`monitoring`), e filtro/ordenação são só sobre o que coube no teto, não sobre a base
inteira. Isso piora conforme a empresa acumula histórico — exatamente o público-alvo
(escritórios de engenharia que usam o Pilar por anos).

## Objetivo

Dashboard financeiro e listagens de Despesas/Receitas respondem com tempo
independente do histórico acumulado da empresa: banco agrega/filtra/pagina, front só
renderiza. Nenhuma tela financeira faz full-scan client-side depois desta spec.

**Fora de escopo:**
- Mudar QUALQUER regra de negócio de cálculo (o número exibido tem que continuar
  idêntico ao que sai hoje do JS — isto é migração de onde o cálculo roda, não do que
  ele calcula).
- Mexer em Lancamentos (`get_lancamentos_pagina`/`get_lancamentos_resumo`, spec 033):
  já é server-side, serve de modelo.
- Aba Fluxo de Caixa e Mensal (não auditadas nesta spec; se tiverem o mesmo padrão,
  viram spec própria).

## Contexto: infraestrutura irmã já existe (spec 033 / ADR 0017)

O módulo já resolveu esse exato problema para a aba **Lancamentos**:
- View `public.lancamentos` (`20260821000000_lancamentos_fonte_unica.sql`):
  `UNION ALL` de `receitas`+`despesas` com nomes já resolvidos (categoria, projeto,
  contraparte, conta), `security_invoker = true` (RLS normal por `empresa_id`).
- RPC `get_lancamentos_pagina(filtros..., p_sort_key, p_sort_dir, p_limit, p_offset)`:
  filtro+ordenação+paginação no banco.
- RPC `get_lancamentos_resumo(filtros...)`: totais do MESMO conjunto filtrado —
  "lista e totais não podem divergir" é a garantia de design.

Isso muda a pergunta desta spec de "como construir server-side do zero" para "como
estender/reusar essa base pro dashboard e pras abas Despesas/Receitas". A view
`lancamentos` cobre quase tudo que `useFinanceItems` precisa, com duas lacunas
conhecidas: (1) não filtra `is_fatura_payment` (a coluna existe, falta o predicado no
RPC/query), (2) não tem os campos Asaas (`asaas_payment_id/url/status/billing_type`,
só existem em `receitas`, não estão na view).

## Requisitos

1. O dashboard (`useFinanceData`) busca `stats` (totais, crescimento %, a
   receber/pagar, top 5) via UMA RPC que roda a mesma lógica de filtro por
   `data_vencimento`/`data_recebimento`/`data_pagamento` (via `getDisplayDate`, hoje
   em `src/lib/dateUtils.ts`) que o JS já usa — reimplementada em SQL.
2. O dashboard busca os dados de gráfico (mensal, diário/semanal/mensal adaptativo,
   categoria) via RPC(s) separadas da de `stats` (podem ser chamadas em paralelo;
   um erro de gráfico não deve derrubar os KPIs).
3. Em "todo o período" (sem `dateFrom`/`dateTo`), a RPC de stats NÃO faz full-scan sem
   agregação: soma/contagem agregadas no banco, não `SELECT *` trazido inteiro.
4. Abas Despesas e Receitas (`useFinanceItems`) usam paginação server-side (RPC ou
   view com `.range()`), com filtro e ordenação também no banco — não mais um teto
   fixo de linhas.
5. O valor de cada estatística (receitasTotal, despesasTotal, saldo, crescimento %,
   aReceber/aPagar com contagem, top 5) tem que bater EXATAMENTE com o que o código
   atual calcula, para as mesmas datas de entrada — ver Critérios de aceite.

Requisitos não-funcionais:

- **Segurança / RLS:** RPCs `SECURITY DEFINER` (ou view `security_invoker` + RPC
  fina) derivam `empresa_id` de `get_user_empresa_id()`, nunca aceitam `empresa_id`
  do client — mesmo padrão endurecido nas 3 RPCs de
  `20260835000000_fecha_rpc_authenticated_cross_tenant.sql` desta sessão. pgTAP
  cross-tenant obrigatório antes de merge (mesmo padrão de `rls_security.sql`).
- **Performance:** nenhuma query financeira sem `LIMIT`/agregação no "todo o
  período". Índice em `(empresa_id, data_vencimento)` e `(empresa_id,
  data_recebimento)`/`(empresa_id, data_pagamento)` se `EXPLAIN` mostrar seq scan.
- **Multi-tenant:** isolamento por `empresa_id` mantido; ver RLS acima.
- **Paridade com Lancamentos:** se a view `lancamentos` já resolve um campo (nome de
  categoria/projeto/contraparte), reusar em vez de duplicar JOIN.

## Critérios de aceite

- [ ] Dado um período com receitas e despesas conhecidas, quando `useFinanceData`
      chama a nova RPC, então `stats.receitasTotal`/`despesasTotal`/`saldo` batem
      byte-a-byte com o valor hoje calculado em JS para o MESMO período (teste de
      regressão: capturar um snapshot real de staging antes/depois).
- [ ] Dado o modo "todo o período" (sem `dateFrom`/`dateTo`), quando a RPC roda,
      então nenhuma query de `stats` faz `SELECT *` sobre a tabela inteira (`EXPLAIN`
      mostra agregação, não seq scan trazendo todas as linhas pro client).
- [ ] Dado o crescimento % (mês atual vs anterior), quando o período anterior tem
      total zero, então a RPC devolve `0`, igual ao JS hoje (`receitasPrevTotal > 0 ?
      ... : 0`).
- [ ] Dado o gráfico diário/semanal/mensal adaptativo, quando o intervalo é ≤45 dias,
      então a granularidade é diária; ≤365 dias, semanal; >365, mensal — mesmos
      limiares do `processDailyChartData` atual.
- [ ] Dado um usuário da Empresa A, quando ele chama a nova RPC/paginação com um
      `empresa_id` ou dado de outra empresa forjado no filtro, então recebe erro ou
      zero linhas — nunca dado da Empresa B (pgTAP obrigatório, ver
      `rls_security.sql`/`anon_function_grants.sql` como modelo).
- [ ] Dado mais de 2000 lançamentos de despesa numa empresa, quando o usuário abre a
      aba Despesas, então a lista pagina (scroll infinito ou páginas) em vez de
      truncar silenciosamente, e o filtro/ordenação continuam corretos sobre a base
      inteira, não só sobre a página carregada.
- [ ] Dado um pagamento de fatura de cartão (`is_fatura_payment = true`), quando a
      aba Despesas lista, então ele continua EXCLUÍDO da listagem (paridade com o
      `.eq("is_fatura_payment", false)` atual).
- [ ] Dado um registro de receita com campos Asaas preenchidos, quando a aba Receitas
      lista, então `asaas_payment_id/url/status/billing_type` continuam aparecendo
      (não pode se perder na migração pra uma fonte compartilhada com despesas).

## Dados e contratos

Proposta inicial (refinar no plano de implementação):

- **`get_finance_stats(p_data_inicio date, p_data_fim date, p_all_time boolean)`**
  → `jsonb` ou `TABLE` com: `receitas_total`, `despesas_total`, `receitas_total_geral`,
  `despesas_total_geral`, `receitas_growth_pct`, `despesas_growth_pct`,
  `a_receber_total`, `a_receber_count`, `a_pagar_total`, `a_pagar_count`,
  `top_receitas jsonb`, `top_despesas jsonb` (cada item: id, descricao, valor, data,
  status — top 5 por valor).
- **`get_finance_chart_mensal(p_data_inicio date, p_data_fim date, p_all_time
  boolean)`** → `SETOF (mes text, receitas numeric, despesas numeric)`, uma linha por
  mês com dado (equivalente a `processChartData`).
- **`get_finance_chart_periodo(p_data_inicio date, p_data_fim date, p_all_time
  boolean)`** → `SETOF (bucket_label text, receitas numeric, despesas numeric)`, com a
  granularidade (dia/semana/mês) decidida na função a partir do span, igual
  `processDailyChartData`. Buckets vazios do intervalo entram com 0 (pré-preenchidos),
  igual ao comportamento atual.
- **`get_finance_categorias(p_data_inicio date, p_data_fim date, p_all_time boolean,
  p_tipo text)`** → `SETOF (categoria_nome text, valor numeric, count integer)` — cor é
  responsabilidade do front (já é hoje, `processCategoryData` só atribui paleta).
- **Despesas/Receitas paginadas:** estender `get_lancamentos_pagina` com um filtro
  `p_tipo` (já existe `tipo` na view) OU criar `get_despesas_pagina`/
  `get_receitas_pagina` dedicadas se as colunas específicas (Asaas, parcelas) tornarem
  a view genérica insuficiente — decidir no plano depois de mapear campo a campo.
- Todas as funções: `SECURITY DEFINER`, `empresa_id` de `get_user_empresa_id()`,
  `SET search_path = public`, allowlist explícita de grants (sem depender de default).

## Plano de implementação

_A aprovar antes de codar._

1. Mapear campo a campo `DespesaItem`/`ReceitaItem` (useFinanceItems.ts) contra a view
   `lancamentos` — decidir estender a view (adicionar Asaas) vs. RPC dedicada por tipo.
2. Escrever as 4 RPCs de `useFinanceData` (stats, chart mensal, chart período,
   categorias) numa migration, com pgTAP cross-tenant cobrindo cada uma.
3. Capturar um snapshot dos valores atuais de `useFinanceData` em staging (script
   pontual, não fica no repo) pra usar como fixture de regressão nos testes das RPCs.
4. Trocar `useFinanceData` pra chamar as 4 RPCs em paralelo (`Promise.all`), mantendo
   o mesmo shape de retorno pro componente consumidor não mudar.
5. Trocar `useFinanceItems` pra paginação server-side (infinite query, mesmo padrão de
   `useLancamentosPaginados`), adaptando `DespesasTable`/`ReceitasTable` (verificar se
   já usam `DataTable` — se sim, plugar paginação server-side nele; se não, ver se
   cabe na regra dos 3 usos do ADR 0008 antes de customizar de novo).
6. Rodar os dois hooks antigos e novos lado a lado num ambiente de teste, comparar
   output, só então remover o código antigo.
7. `npm run gen:types` + suíte pgTAP + `deno-check` (nenhuma Edge Function deveria ser
   afetada, mas conferir) + smoke manual no browser antes de considerar pronto.

## Decisões e riscos

- **Risco maior:** granularidade adaptativa do gráfico diário/semanal/mensal em SQL é
  a parte mais arriscada de acertar igual ao JS (edge cases de fuso, bucket vazio,
  ISO week start). Vale escrever isso com teste de unidade em SQL (pgTAP) comparando
  contra casos fixos ANTES de trocar o hook, não depois.
- **Decisão em aberto:** estender a view `lancamentos` com Asaas vs. manter RPCs
  dedicadas para despesas/receitas. Estender reaproveita mais código mas acopla dois
  domínios (parcelamento, fatura) que hoje são independentes; ADR se a decisão for
  não-óbvia.
- **Decisão em aberto:** `useFinanceItems` migra pra `useInfiniteQuery` (scroll
  infinito, como Lancamentos) ou paginação por página (anterior/próximo)? Lancamentos
  usa infinite scroll; manter consistência a menos que a tela tenha um motivo forte
  pra divergir.
- Nenhum ADR novo previsto — a decisão de arquitetura (RPC server-side pra dado
  financeiro) já está coberta por [ADR 0017](../architecture/adr/0017-lancamentos-pagina-server-side.md).
