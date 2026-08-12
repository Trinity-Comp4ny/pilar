# SPEC: Lançamentos com fonte única, filtros e parcelas honestas

**Data:** 2026-08-12
**Status:** Aprovada
**Autor:** Matheus + painel (ux-qa, engenheiro-icp, critico-red-team)
**Módulo:** financeiro

Depende de: [024 — Filtros do Financeiro padronizados](024-filtros-financeiro-padronizados.md), [025 — Padronização de filtros do sistema](025-padronizacao-de-filtros-do-sistema.md)
ADR: [0017 — Página de lançamentos server-side](../architecture/adr/0017-lancamentos-pagina-server-side.md)

## Problema

O dono do escritório abre "Lançamentos" para saber pra onde vai o dinheiro dos
projetos e o que vence, e a tela confunde. Três causas medidas no código, não
opinião:

1. **Colunas e busca quebradas.** A view `lancamentos` traz só IDs; o enrichment
   força `categoria_nome`/`projeto_codigo`/`contraparte_nome`/`conta_nome` a `null`
   (`useLancamentosPaginados.ts:129-137`). As colunas Cliente/Categoria/Projeto
   aparecem vazias e a busca só acha `descrição`. É o "a busca pesquisa o quê?"
   que a design partner (VRZ) perguntou.
2. **Números que discordam.** KPIs vêm de RPC que só respeita o período
   (`Lancamentos.tsx:60-71`); filtro, ordenação, totais do rodapé e o contador
   "X de Y" rodam client-side sobre a página já carregada
   (`LancamentosTable.tsx:137-209`). Filtrar por projeto não muda o KPI; "atrasados"
   varre só as ~100 linhas carregadas; o saldo do rodapé muda a cada "Carregar mais".
3. **Parcela mostra fragmento como todo.** Default `mes-atual` corta o parcelamento
   12x em 1 linha; a linha-grupo soma só o visível, recalcula status do visível e
   estampa "1 de 12x" sem o usuário ter filtrado (`LancamentosGroupRow.tsx:55-135`).
   Falta saldo devedor, progresso e próxima parcela.

Some a discoverability: filtros num `Sheet` lateral (anti-padrão confirmado por
Conta Azul/Mercury/setproduct e destoa do padrão Popover do resto do app), status
e projeto escondidos no porão, e o tipo `QuickFilter` de atalho existe no código e
nunca foi ligado (`lancamentosFilters.ts:15`).

## Objetivo

Ao abrir Lançamentos, o usuário responde em segundos "o que vence, o que está
atrasado e como está cada projeto", com um único conjunto de números que sempre
bate com o filtro ativo. Parcelamento aparece com saldo, progresso e próxima
parcela, sem depender do período.

**Fora de escopo:**
- Filter-builder estilo ClickUp e saved views (ADR 0014 mantém fora).
- Seletor de data-âncora com 4 visões (competência/vencimento/caixa) à la Conta Azul.
  Mantemos **vencimento** como âncora única, com rótulo explícito. Reavaliar depois.
- Exportar para planilha (candidato futuro).
- Módulos dormentes do Financeiro (Aging, DRE, WIP, Projeção).

## Requisitos

Funcionais:

1. As colunas Cliente/Fornecedor, Categoria e Projeto mostram o nome real, não "-".
2. A busca encontra por descrição, cliente, fornecedor, categoria e código de projeto.
3. Filtro, ordenação, contagem e totais refletem **todo** o conjunto que casa com o
   filtro no período, não só a página carregada.
4. Os KPIs do topo refletem o filtro ativo (período + tipo + status + demais), e o
   rodapé bate com eles. Um número, uma regra.
5. A tela mostra o recorte ativo em texto ("Vendo: agosto/2026 · por vencimento").
6. Quick filters de intenção na barra principal: **Em aberto**, **Atrasados**,
   **Vence esta semana**, **Pagos**. "Atrasados" e "Vence esta semana" ajustam o
   período automaticamente (furam o "mês atual") para não devolver lista vazia.
7. Filtro de status e de projeto ficam acessíveis na barra principal (não só no avançado).
8. O painel de "mais filtros" abre em **Popover** no padrão `ProjetosFilterBar`, não em `Sheet`.
9. Clicar num KPI aplica o filtro correspondente (A pagar → despesa + em aberto, etc.).
10. A linha-grupo de parcela mostra: total do plano (`grupo_total_original`), valor pago,
    saldo devedor, progresso "k de N pagas", próxima parcela em aberto (data + valor) e
    badge com `grupo_status` canônico. O grupo representa o plano inteiro, não o recorte.
11. Empty state distingue "nenhum lançamento com esses filtros" (com "limpar filtros")
    de "nenhum lançamento ainda" (com "criar receita/despesa").

Não-funcionais:

- **Segurança / RLS:** a RPC e a view rodam com `security_invoker`/`SECURITY DEFINER`
  respeitando `empresa_id = empresa_do_usuario()`. Nenhum dado cruza tenant.
- **Performance:** a lista não faz full-scan client-side; filtro/ordenação/paginação
  e agregação acontecem no banco. Página keyset mantida.
- **Multi-tenant:** isolamento por `empresa_id` preservado em toda query e RPC.

## Critérios de aceite

- [ ] Dado um lançamento com cliente X, quando a lista carrega, então a coluna
      Cliente/Fornecedor mostra "X" (não "-").
- [ ] Dado que busco "X" (nome de cliente), então o lançamento dele aparece.
- [ ] Dado 300 despesas atrasadas, quando filtro "Atrasados", então a contagem e os
      totais refletem as 300, não só as carregadas.
- [ ] Dado que filtro por um projeto, então o KPI "A receber" e o rodapé mudam juntos
      e batem entre si.
- [ ] Dado um parcelamento 12x com 5 pagas, quando vejo a linha-grupo, então leio
      "5 de 12 pagas · falta R$ N · próxima 10/09", e o total é o do plano inteiro,
      independente do período selecionado.
- [ ] Dado período "mês atual" sem lançamento, então o empty state diz "nenhum
      lançamento ainda" (não "ajuste os filtros").
- [ ] Caso de borda: transferência (sem grupo, sem projeto) não quebra agrupamento
      nem agregação.
- [ ] `npm run typecheck`, `test:run` e lint verdes.

## Dados e contratos

**View `lancamentos` (alterada):** incluir `categoria_nome`, `projeto_codigo`,
`contraparte_nome`, `conta_nome` via LEFT JOIN, mantendo `security_invoker = true`.
Conserta o enrichment na fonte para todos os consumidores.

**RPC `get_lancamentos_pagina` (nova):** aceita o filtro completo (período, tipo,
status, categorias[], projetos[], clientes[], fornecedores[], formas[], valor_min/max,
busca, sort_key, sort_dir, cursor keyset). Retorna a página de linhas já com nomes.

**RPC `get_lancamentos_resumo` (nova):** mesmo filtro, retorna
`{ total_count, receitas, pago, a_receber, a_pagar, atrasados_count, saldo }` do
conjunto filtrado. Alimenta KPIs + rodapé de uma fonte só.

**RPC `get_grupos_parcela_resumo` (nova):** dado `grupo_ids[]`, retorna por grupo
`{ total_original, total_pago, saldo, pagas, total_parcelas, proxima_venc, proxima_valor, status }`.
Alimenta a linha-grupo com o plano inteiro, independente do período.

Shape consumido pelo front detalhado no ADR 0017.

## Plano de implementação

1. **Migration**: view com nomes + 3 RPCs (`get_lancamentos_pagina`,
   `get_lancamentos_resumo`, `get_grupos_parcela_resumo`), com `GRANT EXECUTE` a
   `authenticated` e filtro `empresa_id`. `gen:types:local`.
2. **Hook**: `useLancamentosPaginados` passa a filtrar/ordenar/paginar server-side
   (RPC pagina) + `useLancamentosResumo` (KPIs/rodapé) + `useGruposResumo` (parcelas).
   Remover o filtro/sort/totais client-side de `LancamentosTable`.
3. **FilterBar**: `Sheet` → Popover padrão; quick filters de intenção (religar
   `QuickFilter`); status + projeto na barra; placeholder de busca claro; chips com
   tipo e período; empty states distintos; rótulo de recorte.
4. **KPIs clicáveis** em `Lancamentos.tsx`.
5. **Linha-grupo** reconstruída com resumo do plano (saldo/progresso/próxima/status).
6. **Limpeza**: deletar `LancamentosToolbar` (morto), presets de trimestre no modelo,
   ocultar "1/1", alinhar definição de "filtro ativo", toque/affordances.
7. **Verificação**: typecheck, lint, testes; browser (`dev:local`) com empresa que
   tenha 12x + atrasados; sessão de 15 min com a VRZ na tela nova.
8. **Deploy**: `db:push:staging` + `gen:types` (staging) + commit do `types.ts`.

## Decisões e riscos

- **Server-side é decisão de arquitetura → [ADR 0017](../architecture/adr/0017-lancamentos-pagina-server-side.md).**
- Risco: a RPC de página com muitos filtros opcionais pode ficar complexa. Mitigar
  com índices em `data_vencimento`, `empresa_id`, `projeto_id`, `status`.
- Risco: agregação de grupo por parcela precisa varrer as parcelas do grupo fora do
  período. Aceitável (grupos são pequenos), mas medir.
- Suposição: volume por empresa (escritório de engenharia) é de centenas a poucos
  milhares de lançamentos. Se furar, os índices seguram; se não, materializar resumo.
