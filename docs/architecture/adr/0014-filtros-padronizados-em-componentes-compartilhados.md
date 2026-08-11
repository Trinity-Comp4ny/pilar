# ADR 0014 — Filtros padronizados em componentes compartilhados

Status: Aceito
Data: 2026-08-11
Relacionado: [ADR 0010 — Calendário compartilhado por camadas](0010-calendario-compartilhado-por-camadas.md), [spec 024 — Filtros do Financeiro padronizados](../../specs/024-filtros-financeiro-padronizados.md), [spec 025 — Padronização de filtros do sistema](../../specs/025-padronizacao-de-filtros-do-sistema.md)

## Contexto

Uma sessão de uso com design partner (11/08/2026) expôs inconsistência nos filtros do
Financeiro (calendário sempre aberto, navegação mês a mês, "Todo o período" faltando em
telas). A spec 024 corrigiu isso criando componentes compartilhados (`FiltroPeriodo`,
`FiltroCompetencia`, fonte única `lib/periodo.ts`).

Um inventário do app inteiro mostrou que a inconsistência não é só do Financeiro. Existem
**4 implementações independentes de filtro de data com preset** (Financeiro, Relatórios,
Projetos, Timesheet) mais dois filtros temporais "por prazo" reinventados à mão (Leads,
Meu trabalho); `MultiSelectFilter` existe mas está preso em `pages/financeiro/` (Projetos
reescreveu a mesma coisa do zero); não há `useUrlState` genérico nem qualquer "saved
views".

Surgiu a pergunta de trazer um construtor de filtros estilo ClickUp (campo + operador +
valor, filtros aninhados, views salvas) para todo o sistema.

## Decisão

1. **Filtro é componente compartilhado, não implementação por tela.** Todo filtro de
   período usa `FiltroPeriodo`; competência usa `FiltroCompetencia`; multi-seleção usa
   `MultiSelectFilter`. A lógica de preset→datas vive só em `lib/periodo.ts`. Componentes
   de filtro reutilizáveis moram em `src/components/filters/`.

2. **Não construir um filter-builder genérico (estilo ClickUp) nem saved views agora.**
   Campo+operador+valor+aninhamento+views salvas por usuário é, na prática, uma linguagem
   de query: alto custo (operador por tipo de campo, persistência por usuário) e fora da
   dor do ICP. O ICP é dono/sócio de engenharia multidisciplinar, cuja promessa é "saber
   se o projeto dá lucro" — ele quer **resposta**, não montar query. A dor observada foi
   consistência e um bom seletor de data, não falta de poder de filtragem.

## Consequências

- Positivas: uma só cara e um só comportamento de filtro no app; correção num lugar vale
  para todas as telas; menos código (mata 4 duplicações de date-range).
- Custo: refatorar as telas que hoje reimplementam filtro (ver spec 025), em camadas.
- Gatilho de reabertura do filter-builder/saved-views: um cliente do ICP pedir **por
  escrito** para salvar/reusar recortes de filtro, ou aparecer persona de gestão de tarefas
  que viva de query. Até lá, o kernel útil do ClickUp que adotamos é só o conjunto rico de
  presets de data (incluindo trimestre).
- O par busca + chips ativos + contador (hoje mais maduro no `LancamentosFilterBar`) pode
  virar um `FilterBar` compartilhado no futuro; fora do escopo imediato.
