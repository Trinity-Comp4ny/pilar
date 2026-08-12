# ADR 0017 — Página de lançamentos server-side

Status: Aceito
Data: 2026-08-12
Relacionado: [spec 033 — Lançamentos com fonte única](../../specs/033-lancamentos-fonte-unica-filtros-parcelas.md), [ADR 0014 — Filtros padronizados](0014-filtros-padronizados-em-componentes-compartilhados.md), [ADR 0001 — Arquitetura multi-tenant](0001-arquitetura-multi-tenant.md)

## Contexto

A aba Lançamentos pagina a view `lancamentos` por keyset (100 linhas por página,
`useLancamentosPaginados.ts`) mas aplica **filtro, ordenação, agregação e agrupamento
de parcelas no cliente**, sobre as páginas já carregadas (`LancamentosTable.tsx:137-260`).
Os KPIs do topo vêm de uma RPC separada (`get_lancamentos_kpis`) que só recebe o período.

Consequência medida: três painéis de números (KPI, rodapé, tabela) medem universos
diferentes para o mesmo período e discordam; "atrasados"/busca/ordenação operam só sobre
a página carregada e mentem; o contador "X de Y" usa `Y = linhas carregadas`, não o total
real. Além disso, a view não traz nomes (só IDs) e o enrichment client-side os zera, então
colunas e busca por nome ficam quebradas.

Um redesign só de UI (layout de filtros) não corrige nada disso, os números continuam
divergindo. A design partner confirmou as três falhas em uso real.

## Decisão

1. **Filtro, ordenação, paginação e agregação da lista de lançamentos vão para o banco.**
   Três RPCs `SECURITY DEFINER` com filtro `empresa_id = empresa_do_usuario()`:
   - `get_lancamentos_pagina(filtros, cursor)` — página keyset já com nomes joinados.
   - `get_lancamentos_resumo(filtros)` — `total_count`, receitas, pago, a_receber,
     a_pagar, saldo, `atrasados_count` do conjunto filtrado. **Fonte única** de KPI e rodapé.
   - `get_grupos_parcela_resumo(grupo_ids)` — total do plano, pago, saldo, k/N pagas e
     próxima parcela por grupo, **independente do período** exibido.

2. **A view `lancamentos` passa a expor os nomes** (`categoria_nome`, `projeto_codigo`,
   `contraparte_nome`, `conta_nome`) via LEFT JOIN, mantendo `security_invoker = true`.
   Corrige o enrichment na fonte, para todos os consumidores, não só esta tela.

3. **O cliente deixa de filtrar/ordenar/somar.** `LancamentosTable` renderiza o que a RPC
   devolve. O agrupamento visual de parcelas continua no cliente (é layout), mas os números
   do grupo vêm de `get_grupos_parcela_resumo`, não da soma das linhas visíveis.

Descartado: manter client-side e apenas "buscar tudo do período" (auto-fetch de todas as
páginas). Resolveria os números no período pequeno, mas colapsa em período largo/"tudo",
não conserta os nomes na fonte e mantém a lógica financeira crítica (o que é "atrasado",
"pago", "saldo do grupo") espalhada no front. Server-side põe a regra financeira onde ela
pertence e escala.

## Consequências

- Positivas: KPI, rodapé e contagem passam a medir o mesmo universo e sempre batem com o
  filtro; "atrasados"/busca/ordenação corretos sobre a base inteira; colunas e busca por
  nome funcionam; a regra financeira (atrasado/pago/saldo) fica no banco, testável em SQL.
- Custo: migration com 3 RPCs + view; `gen:types`; reescrita do hook e da tabela; deploy
  em staging antes de produção (ADR 0007, ambiente explícito). Migration nasce só local.
- Risco: RPC com muitos filtros opcionais fica verbosa. Mitigar com índices em
  `empresa_id`, `data_vencimento`, `projeto_id`, `status` e um único caminho de query.
- Risco: agregar grupo por parcela varre parcelas fora do período. Grupos são pequenos;
  medir e, se furar, materializar o resumo em `grupos_parcela` via trigger.
- Gatilho de revisão: se o volume por empresa passar de dezenas de milhares e a RPC de
  resumo passar do limite de latência aceitável, materializar agregados (view materializada
  ou colunas denormalizadas atualizadas por trigger).
