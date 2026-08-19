# ADR 0027: Ativar Sentry Application Metrics e replay completo de agentes IA

**Data:** 2026-08-19
**Status:** Accepted

## Contexto

O Pilar já tem observabilidade Sentry via HTTP Envelope direto ([ADR 0004](./0004-edge-function-observability.md)), incluindo spans `gen_ai.chat`/`gen_ai.invoke_agent`/`gen_ai.execute_tool` (`_shared/sentry.ts`) que alimentam o dashboard Insights > Agents. De propósito, esses spans hoje mandam só `gen_ai.usage.input_tokens`/`output_tokens` e o modelo, nunca `gen_ai.input.messages`/`output.messages`, para não vazar dado de cliente (financeiro, PII) para a infraestrutura do Sentry.

Duas telas novas do Sentry foram avaliadas para ativação:

- **Agents (Explore > Agents)**: replay de conversa (mensagem por mensagem, tool call, handoff). Exige literalmente o conteúdo das mensagens; sem isso a tela fica vazia.
- **Application Metrics (Explore > Metrics)**: contadores/gauges/distribuições numéricas (ex.: chamadas de IA por empresa, checkouts concluídos, erros de rate limit). Não carrega conteúdo de mensagem, é telemetria agregada.

O onboarding do Sentry para as duas mostra instruções para `@sentry/nextjs` + Vercel AI SDK, que não se aplicam ao stack do Pilar (Vite no frontend, chamada direta ao Gemini nas edge functions Deno, sem SDK oficial ali por causa do ADR 0004). O ganho de ambas as telas é real (debug de agente e métricas de produto), então a extensão é sobre o formato de envelope já existente, não sobre instalar o SDK oficial.

Opções consideradas para o Agents:

- **Enviar mensagens completas em produção** (escolhida): máximo valor de debug, aceita o trade-off de mandar conteúdo de cliente para o Sentry (LGPD).
- **Scrub + só staging**: reduz o risco mas também reduz o valor (staging não reproduz volume/casos reais de produção).
- **Não ativar**: mantém o status quo (só métricas agregadas).

## Decisão

**Agents:** estender `recordGenAiSpan`/`recordGeminiChatSpan` (`_shared/ai-client.ts`) para incluir `gen_ai.input.messages` e `gen_ai.output.messages` nos spans `gen_ai.chat`, em todos os ambientes (staging e produção). Reaproveitar a função `scrub()` já existente em `_shared/sentry.ts` (mascara `SENSITIVE_KEYS` e, se necessário, extrair os padrões PII de `src/lib/monitoring.ts` para um helper compartilhado) antes de anexar as mensagens ao span, para não mandar CPF/CNPJ/senha/token em claro mesmo dentro do conteúdo da conversa.

Completa o Agents (necessário pra tela Conversations do Sentry funcionar de verdade, não só pra Insights agregado):

- `AiRequest.conversationId` (novo campo opcional) vira o atributo `gen_ai.conversation.id` em todos os spans `gen_ai.chat`/`gen_ai.invoke_agent` de uma chamada. Só `ai-chat` popula (usa o `sessionId` que já existe), os outros 13 agentes `ai-*` são one-shot e não têm conversa multi-turno pra agrupar.
- `setSentryUser()` (novo, em `_shared/sentry.ts`, via `AsyncLocalStorage` no mesmo padrão do `genAiSpanStore`) identifica o usuário/empresa da invocação atual, propagado pro campo `user` da transaction enviada. `ai-chat` chama isso uma vez logo após resolver o usuário autenticado.
- `pilar.empresa_id` vai automaticamente em todo span `gen_ai.*` de todos os 14 agentes (já vem de `AiRequest.empresaId`, sem precisar tocar nos 14 handlers).
- **Correção de amostragem**: `withSentry` só mandava a transaction (e os spans `gen_ai.*` dentro dela) quando a invocação caía na amostra de `SENTRY_TRACES_RATE` (default 0.1). Como a doc do Sentry avisa ("tracing must be enabled for agent monitoring to work"), isso descartava ~90% das execuções de IA do dashboard de Agents sem ninguém perceber. Corrigido: a transaction agora sempre sai quando há spans `gen_ai.*`, independente da amostragem de performance geral (que continua em 0.1 pras invocações sem IA, por custo).

**Metrics:** estender o envelope manual de `_shared/sentry.ts` com um novo item type `trace_metric` (formato Sentry para métricas, confirmado em develop.sentry.dev), expondo uma função `recordMetric(name, value, { type: "counter" | "gauge" | "distribution", tags })` para uso nas edge functions. No frontend, usar a API nativa `Sentry.metrics.{count,gauge,distribution}` do `@sentry/react` (já na versão `^10.70.0`, acima do mínimo `10.25.0` exigido) em `src/lib/monitoring.ts`.

Escopo inicial de métricas de negócio (a definir na implementação, não fechado por este ADR): chamadas de IA por empresa/custo, checkouts concluídos, erros de rate limit por rota.

## Consequências

**Positivas:**

- Dashboard Insights > Agents passa a mostrar a conversa real (mensagens, tool calls), não só custo/tokens: acelera debug dos 14 agentes `ai-*`.
- Application Metrics dá visibilidade agregada de métricas de produto sem precisar de dashboard próprio.
- Ambas reaproveitam o envelope HTTP manual do ADR 0004: zero dependência nova nas edge functions.

**Negativas:**

- Conteúdo de mensagem de cliente (prompt e resposta dos agentes IA) passa a trafegar para a infraestrutura do Sentry em produção: dado potencialmente sensível (financeiro, dados de projeto) sob a guarda de um terceiro, mesmo com scrub de padrões conhecidos (CPF/CNPJ/cartão). Scrub por regex não é garantia total contra vazamento de dado sensível em texto livre.
- Manutenção manual do formato de envelope de metrics, que é mais novo e menos estável historicamente que `event`/`transaction` (protocolo estável desde 2020, mencionado no ADR 0004).

## Decisões relacionadas

- [ADR 0004](./0004-edge-function-observability.md): base do envelope HTTP manual que esta decisão estende.
