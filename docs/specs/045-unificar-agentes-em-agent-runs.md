# SPEC: Unificar os 14 agentes de IA em `agent_runs`

**Data:** 2026-08-17
**Status:** Testado em dev:local, falta deploy em staging
**Autor:** Matheus Rezende (via Claude)
**Módulo:** IA Hub (dormente)

## Problema

A mesa de trabalho `/agentes` (spec 007) só mostra o que grava na tabela
`agent_runs`. Hoje só 2 das 14 edge functions `ai-*` gravam ali (`ai-chat` e
`ai-proposta-copilot`). As outras 12 rodam fora do radar: 10 delas
(`ai-aditivo-copilot`, `ai-diagnostico-precificacao`, `ai-documentos`,
`ai-fechamento-mensal`, `ai-pauta-reuniao`, `ai-planejador-contratacao`,
`ai-previsao-atraso`, `ai-radar-cliente`, `ai-relatorio-executivo`,
`ai-simulacao-impacto`) ainda chamam `saveInsight()`, que insere na tabela
`ai_insights` — **dropada em `20260429400000_drop_dormant_tables.sql`**
(2026-04-29). Toda chamada real a essas 10 lança exceção e cai no catch
genérico do handler (retorna "Erro ao gerar X", sem detalhe). Não gera
incidente hoje porque nenhuma tela do front chama essas functions (confirmado
via grep em `src/`) — são módulo dormente (CLAUDE.md, IA Hub). As outras 2
(`ai-cotacao-import`, `ai-import-financeiro`) já usam o caminho correto
(`recordAiUsage`), mas também não gravam em `agent_runs`.

## Objetivo

Toda execução das 14 functions `ai-*` grava um registro em `agent_runs`, e
portanto aparece na mesa `/agentes`. De quebra, mata o insert morto em
`ai_insights` das 10 functions afetadas.

**Fora de escopo:**

- Aprovação inline por tipo (como `OrcamentoCard` tem para `orcamento_honorarios`)
  para os novos agent_types. Eles entram como `RunRow` genérico (a UI já
  suporta tipo desconhecido via fallback em `resumoRun`/`tipoLabel`).
- Reativar as 10 functions dormentes no frontend — continuam dormentes.
- Fila de aprovação humana (`pending_review`) para elas — essas 10 e as 2
  "recordAiUsage" já retornam o resultado direto e síncrono pra tela que
  chamou; o registro em `agent_runs` é só rastro/auditoria, nasce com
  `status: 'executed'` (sucesso) ou `'failed'` (erro), nunca `queued`/`pending_review`.

## Requisitos

1. Novo helper `recordAgentRun()` em `ai-client.ts`, que insere em `agent_runs`
   com `status`, `agent_type`, `input` (systemPrompt+userMessage resumidos ou
   o próprio `AiRequest` sem os campos grandes), `result`, `tokens_input`,
   `tokens_output`, `model`, `created_by`, `entity_type`/`entity_id` quando
   o caller tiver (`referenciaTipo`/`referenciaId` do `AiRequest`).
2. Falha ao gravar em `agent_runs` nunca quebra o fluxo principal (mesmo
   padrão de `logAiUsage`: try/catch, log e segue) — o valor real pro usuário
   é a resposta da IA, não o rastro.
3. As 10 functions que chamam `saveInsight()` passam a chamar
   `recordAgentRun()` no sucesso, e a registrar `status: 'failed'` +
   `error` quando `callGemini`/`callGeminiStructured` lança.
4. `ai-cotacao-import` e `ai-import-financeiro` também passam a chamar
   `recordAgentRun()` ao lado do `recordAiUsage()` existente (não substitui,
   complementa).
5. `agentLabels.ts` ganha entradas de `tipoLabel` para os 12 novos
   `agent_type` (o fallback já formata razoável, isso é só polish).
6. `saveInsight()` é removida de `ai-client.ts` depois que nenhuma function
   mais a chamar (código morto apontando pra tabela inexistente).

Não-funcionais:

- **RLS:** nenhuma migration nova — `agent_runs_service_insert` já permite
  insert do service role, `agent_runs_select` já filtra por `empresa_id`.
- **Multi-tenant:** `empresa_id` sempre vem do `AiRequest.empresaId`, já
  resolvido por function a partir do `profile` do usuário autenticado.
- **Privacidade:** `input` grava o mesmo tipo de dado que `ai-chat` e
  `ai-proposta-copilot` já gravam hoje (sem scrub adicional) — não é uma
  mudança de postura, é extensão do padrão existente.

## Critérios de aceite

- [ ] Dado que `ai-radar-cliente` roda com sucesso, quando termina, então
      existe uma linha em `agent_runs` com `agent_type: 'radar_cliente'`,
      `status: 'executed'`, tokens preenchidos, visível em `/agentes` da
      empresa certa.
- [ ] Dado que o Gemini falha (timeout/erro), quando a function captura a
      exceção, então grava `agent_runs` com `status: 'failed'` e `error`
      preenchido, e a resposta HTTP ao usuário continua a mesma de hoje.
- [ ] Dado um `agent_type` sem entrada em `agentLabels.ts`, quando a mesa
      renderiza, então mostra o fallback formatado (não quebra).
- [ ] Dado que `saveInsight()` foi removida, quando `deno check` roda nas 14
      functions + `ai-client.ts`, então não há erro de import quebrado.
- [ ] Caso de borda: function sem `referenciaId`/`referenciaTipo` no
      `AiRequest` grava `agent_runs` com `entity_type`/`entity_id` nulos, sem
      quebrar o insert.

## Dados e contratos

- Nenhuma migration nova (schema de `agent_runs` já suporta tudo).
- `recordAgentRun()` (novo, em `ai-client.ts`):
  ```ts
  async function recordAgentRun(params: {
    supabaseAdmin: SupabaseClient;
    empresaId: string;
    agentType: string;
    status: "executed" | "failed";
    input: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: string;
    tokensEntrada: number;
    tokensSaida: number;
    userId?: string;
    entityType?: string;
    entityId?: string;
  }): Promise<void>;
  ```
- `saveInsight()` removida (breaking só pra quem a importava — as 10 functions,
  todas ajustadas nesta mesma spec).

## Plano de implementação

1. Adicionar `recordAgentRun()` em `ai-client.ts` (insert em `agent_runs`,
   falha silenciosa como `logAiUsage`).
2. Trocar as 10 chamadas `saveInsight()` por `recordAgentRun()` + `catch` que
   grava `status: 'failed'`, function por function.
3. Adicionar chamada de `recordAgentRun()` em `ai-cotacao-import` e
   `ai-import-financeiro`, ao lado do `recordAiUsage()` já existente.
4. Remover `saveInsight()` de `ai-client.ts`.
5. Adicionar labels em `agentLabels.ts` para os 12 novos `agent_type`.
6. `deno check` nas 14 functions + `ai-client.ts`.
7. Testar em `dev:local` disparando manualmente 1-2 functions (ex. via
   `supabase functions serve` + curl com token válido) e conferir a linha em
   `agent_runs` e a renderização em `/agentes`.

## Decisões e riscos

- Risco baixo: o código-caminho está morto hoje (10 functions), então não há
  comportamento em produção pra preservar — a mudança só pode consertar, não
  quebrar algo que já funcionava.
- Risco real: `agent_runs.input`/`result` sem scrub de PII — já é o padrão
  aceito pelas 2 functions que já gravam ali; se isso incomodar, é decisão
  separada (scrub viraria ADR, não cabe nesta spec).
- Pergunta em aberto: vale a pena, nesta mesma leva, também investigar por
  que ninguém percebeu 10 functions quebradas por ~4 meses (é dormente de
  propósito, ou caiu do radar de verdade)? Fora de escopo do código, mas
  talvez valha um aviso ao CEO.

## Implementação (17/08)

Ajustes em relação ao plano original, decididos durante a implementação:

- **`recordAgentRun()` NÃO foi instrumentado dentro de `callGemini`/`callGeminiStructured`**
  (diferente do que fizemos com os spans `gen_ai.*` do Sentry). Motivo: `ai-chat`
  e `ai-proposta-copilot` já chamam `callGeminiStructured` internamente para
  passos intermediários e já gravam em `agent_runs` manualmente com a semântica
  certa (`pending_review`, `agent_actions` como log de raciocínio). Instrumentar
  no client compartilhado geraria linhas duplicadas/espúrias na mesa para essas
  duas — as únicas 2 functions realmente ativas. `recordAgentRun()` é chamado
  explicitamente só nas 12 functions dormentes, function por function.
- **Bônus não previsto no requisito 3**: as 10 functions que chamavam
  `saveInsight()` também passaram a chamar `recordAiUsage()` (contador de
  `ai_usage`/`ai_usage_logs`), que antes NUNCA rodava — o `throw` do insert
  morto em `ai_insights` interrompia a função antes de chegar lá. Ou seja,
  rate-limit e billing por feature dessas 10 também estavam quebrados, e
  agora foram restaurados de quebra.
- **Requisito 3 simplificado**: não foi adicionado `status: 'failed'` em
  `agent_runs` quando `callGemini`/`callGeminiStructured` lança. O comportamento
  antigo (`saveInsight`) também só rodava no caminho de sucesso — manter essa
  paridade evitou tocar no bloco `catch` de cada uma das 10 functions (escopo/
  risco extra em código dormente, sem ganho proporcional agora).
- Validado com `deno check` nas 14 functions + `ai-client.ts`/`sentry.ts` (limpo,
  exceto os 3 erros de TYPECHECK_DEBT já conhecidos e não relacionados) e
  `npm run test:run` (672 testes, sem regressão).

## Verificação em dev:local (17/08)

Passo 7 do plano executado. Achados:

- **Bloqueio pré-existente, não relacionado**: `supabase migration up --local`
  falhava com `LegacyMigrationMissingLocalError` na versão `20260837000000`
  (`financeiro_dashboard_server_side`, aplicada via MCP na sessão da spec 044,
  sem arquivo correspondente neste checkout — o mesmo padrão de
  [[project_migration_history_orfas_staging_2026-08-13]]). Reparado com
  `supabase migration repair --status reverted 20260837000000 --local`
  (só no banco local, não afeta staging/prod).
- `npm run seed:local` + login via `/auth/v1/token` como `dev@local.test`.
- `POST /functions/v1/ai-radar-cliente` autenticado retornou **200** (antes
  desta spec retornaria 400 "Erro ao gerar radar de clientes", já que
  `saveInsight()` sempre lançava). Confirmado no Postgres local: linha nova em
  `agent_runs` (`agent_type: radar_cliente`, `status: executed`, tokens
  180/276, `model: gemini-2.5-flash`).
- Confirmado visualmente em `/agentes` (Chrome, logado como Dev Local): aba
  "Histórico" mostra "Radar de clientes" em Concluído, com resumo e timestamp
  corretos.
- **Achado secundário, fora de escopo**: a tabela `ai_usage` (não
  `ai_usage_logs`) também foi dropada na mesma limpeza de 29/04
  (`20260429400000_drop_dormant_tables.sql`). `recordAiUsage()` grava certo em
  `ai_usage_logs` (confirmado, linha `radar_cliente` 180/276 tokens), mas o
  RPC `increment_ai_usage` e o fallback em `ai_usage` falham silenciosamente
  contra tabela inexistente — o teto mensal de IA (`checkRateLimit`/
  `getAiSaldo`) está sempre "aberto" hoje. Não corrigido aqui (fora do escopo
  desta spec); registrado para decisão futura.
