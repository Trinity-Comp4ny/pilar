# ADR 0006: Arquitetura de IA e agentes no Pilar

**Data:** 2026-07-14
**Status:** Proposed
**Decisores:** Matheus Rezende

## Contexto

O Pilar já tem infraestrutura de IA dormente (11 edge functions `ai-*`, tabelas
`ai_insights` e `ai_usage` da migration 010) e a branch `feat/ai-chat-consultivo`
com um copiloto conversacional em fase consultiva (read-only). Antes de reativar
esse código e crescer para agentes que executam trabalho, precisamos fixar o
padrão-alvo de arquitetura, senão cada função vai reinventar seu próprio jeito de
chamar LLM, cachear resultado, rodar tarefa longa e medir custo.

As restrições reais do Pilar moldam esse padrão:

- **Edge Functions Deno com timeout curto.** Deno Deploy corta a execução em
  poucas dezenas de segundos. Qualquer pipeline de IA de vários estágios (extrair,
  raciocinar, validar, gravar) não cabe numa única invocação síncrona.
- **Sem worker Python de longa duração.** Diferente das plataformas de referência
  internas, não temos Celery, Neo4j nem processo `asyncpg` rodando 24/7. O que temos
  é Postgres + Realtime + edge functions. O padrão precisa ser expresso nesses
  tijolos.
- **Multi-tenant por RLS (ADR 0001).** Toda tabela nova de IA carrega `empresa_id`
  e nega cross-tenant. Custo e uso são por empresa.
- **Custo de IA é a régua de pricing (docs/strategy/PRICING.md).** O modelo de preço
  se ancora no valor da hora do sócio de engenharia, então o custo de IA precisa ser
  medido e traduzível para "quanto de trabalho humano isso substituiu".

Este ADR destila quatro padrões validados em código de plataformas internas de
IA (pipeline de compliance com GraphRAG; pipeline de patentes com worker + fila) e
os traduz para o stack do Pilar. **Nenhum conceito de Python/Celery/Neo4j/Django é
importado como dependência** — só a forma arquitetural.

## Decisão

Adotamos quatro padrões que compõem a arquitetura-alvo de IA do Pilar.

### (a) Pipeline multi-estágio idempotente com cache no banco

Uma tarefa de IA composta (ex.: analisar rentabilidade de um projeto: coletar dados
financeiros, resumir, gerar insight, validar) é quebrada em **estágios**. Cada
estágio:

1. Lê seu input do banco (o resultado do estágio anterior), não de memória do
   processo.
2. Grava seu output numa tabela com **constraint de unicidade que é a própria chave
   de cache** (ex.: `UNIQUE (empresa_id, tipo, referencia_id, mes, ano)`). Rodar o
   estágio de novo com a mesma chave é um `ON CONFLICT DO NOTHING`/`DO UPDATE`, não
   uma segunda chamada de LLM.
3. Avança o `status` do job.

Consequência direta: como cada estágio persiste antes de avançar, uma edge function
pode rodar **um estágio por invocação** e caber no timeout. Se a função morrer no
meio, a reexecução retoma do último estágio persistido em vez de refazer tudo (e
pagar LLM de novo). A referência interna é o pipeline de compliance, que usa
exatamente esse desenho de state machine (`pending → ... → completed`, `any → failed
→ retry`, guarda `retries < 3`).

O estado do pipeline vive na tabela `jobs` (ver ADR-scaffolding abaixo): `status`
enum, `progress` para UI, `input`/`result` em `jsonb`. Estágios de cache específicos
de domínio reusam as tabelas existentes (`ai_insights`, `saude_operacional_snapshots`),
que já têm `UNIQUE (empresa_id, ...)`.

### (b) Agentic RAG: retrieval como tool + saída estruturada com `cited_references`

Quando a resposta de IA precisa citar dados do próprio Pilar (projetos, lançamentos,
propostas), o retrieval **não** é um pré-passo cego que injeta contexto. Ele é uma
**tool que o modelo chama quando decide** e pode reformular a query. Isso vem do
GraphRAG interno, onde o retrieval é registrado como `@agent.tool` e o modelo pode
chamá-lo várias vezes, com um teto de chamadas (`max_tool_calls`) para não estourar
contexto nem custo.

Três invariantes que copiamos:

1. **Score mínimo de relevância.** O retrieval filtra por um limiar
   (`min_relevance_score`); se nada passa, cai para o top-N para o modelo sempre
   receber algum contexto, mas marca `low_relevance_warning`. Abaixo de um piso
   duro (na referência, `best_score < 0.3`), a resposta sinaliza
   `needs_more_context = true` em vez de alucinar.
2. **Saída estruturada, não texto solto.** O agente devolve um objeto com forma fixa
   (o `output_type` do agente). Campos mínimos:

   - `answer` — resposta em linguagem técnica, com citações inline.
   - `cited_references: string[]` — **lista exaustiva de toda referência citada, no
     formato exato**, usando só valores presentes no contexto recuperado. No domínio
     de normas técnicas o formato é `"DNV-ST-F101, Sec 7.2, Para 7.2.3-1, Page 143"`.
     No Pilar o formato análogo aponta a entidade de origem, ex.:
     `"Projeto #1234, Escopo Estrutural, Lançamento 2026-05-12"`. **Campos ausentes
     são omitidos, nunca inventados.**
   - `needs_more_context: boolean`.
   - `follow_up_suggestions: string[]`.

3. **Metadados de recuperação e geração** viajam junto (`retrieval_time_ms`,
   `total_tokens`, `documents_searched`), alimentando os logs de uso (padrão (d)).

Para o Pilar isso significa: quando a fase 1 do chat consultivo evoluir de read-only
para citar fontes, ela retorna `cited_references` no formato acima e respeita o piso
de relevância. O armazenamento vetorial-alvo é **pgvector** no próprio Postgres
(não Neo4j): mantém o retrieval dentro do banco multi-tenant e sob RLS, sem um grafo
externo. A adoção de pgvector fica registrada como próximo passo, não como parte deste
scaffolding.

### (c) Fila de jobs via `pg_notify` + Realtime para tarefa longa

Tarefa que não cabe no timeout (pipeline inteiro, geração em lote, análise pesada) é
**enfileirada, não executada inline**. O padrão vem do pipeline de patentes, onde o
Supabase é o barramento central: o frontend insere um run com `status = 'pending'`,
um trigger dispara `pg_notify`, e um consumidor pega o trabalho; se o `LISTEN` cair,
há **fallback de polling** (`SELECT ... WHERE status = 'pending' ORDER BY created_at`)
com reconexão. O frontend acompanha o progresso via **Realtime subscription** na linha
do job, sem polling do lado do cliente.

Tradução para o Pilar (sem worker Python persistente):

- Tabela `jobs` é a fila. `INSERT` com `status = 'pending'` dispara um trigger
  `AFTER INSERT` que chama `pg_notify('jobs_pending', <job_id>)`.
- O **consumidor** é uma edge function que processa **um estágio por invocação**
  (casando com o padrão (a)) e é acordada por um dos dois caminhos:
  - **Agora (sem infra extra):** um Cron de edge function (pg_cron / scheduler)
    faz o `SELECT ... WHERE status IN ('pending','running')` a cada N segundos — é o
    caminho de polling da referência, que já é o fallback documentado lá.
  - **Depois:** um bridge `pg_notify` → invocação HTTP via `pg_net`, quando quisermos
    latência menor. O trigger e o canal `jobs_pending` já ficam prontos para isso.
- O consumidor faz **claim atômico** da linha (`UPDATE ... SET status='running'
  WHERE id=$1 AND status='pending' RETURNING`) para dois consumidores não pegarem o
  mesmo job.
- A UI assina a linha via Realtime e lê `status`/`progress`/`result`.

Escolhemos `pg_notify` + Realtime em vez de um serviço de fila externo (SQS,
Cloud Tasks) porque não adiciona infra nova, herda o isolamento por RLS e o Realtime
já está no stack.

### (d) Custo de IA como "equivalente-humano"

Todo estágio de IA que chama um modelo registra uma linha em `ai_usage_logs`
(ADR-scaffolding abaixo) com `tokens_in`, `tokens_out`, `cost` **e**
`human_equivalent_hours`. A ideia vem do `agent_context` interno, onde cada agente
declara a quem ele equivale e quanto tempo o humano levaria:

```python
with agent_context(
    agent_name="..._code_applicability_overview",
    agent_employee_equivalent="plan_reviewer",
    hourly_rate=60.0,
    approximate_person_hours=0.5,
    ...
):
    result = agent.run_sync(...)
```

No Pilar, cada tipo de tarefa de IA carrega uma estimativa de `approximate_person_hours`
(quanto um sócio/engenheiro levaria para fazer aquilo à mão). Ao logar, gravamos
`human_equivalent_hours` junto do custo real de tokens. Isso dá duas leituras que o
custo puro em dólar não dá:

- **Para o pricing:** o valor entregue é medido na régua da hora do sócio, que é a
  âncora do modelo de preço, não no custo de inferência.
- **Para o cliente:** "esta análise custou X e substituiu ~Y horas de trabalho" é a
  mensagem de valor do produto.

`human_equivalent_hours` é uma **estimativa por tipo de tarefa**, não uma medição —
fica explícito no comentário da coluna para ninguém confundir com horas cronometradas.

## Alternativas consideradas

1. **Executar pipeline inteiro inline na edge function.** Rejeitado: estoura o
   timeout do Deno e refaz (e re-paga) tudo em qualquer falha parcial.
2. **Worker Python de longa duração (padrão das plataformas de referência).**
   Rejeitado por ora: adiciona infra que o Pilar não tem (processo persistente,
   deploy próprio) para volume que ainda não existe. O padrão de fila foi desenhado
   para poder migrar para isso depois sem mudar o schema.
3. **Neo4j + grafo para RAG.** Rejeitado: pgvector no Postgres mantém retrieval sob
   RLS multi-tenant e sem um segundo banco para operar.
4. **Contexto sempre injetado (RAG clássico sem tool).** Rejeitado para casos que
   precisam citar fonte: o modelo perde a chance de reformular a busca e o custo de
   contexto cresce sem controle. Mantemos injeção direta só para casos triviais.
5. **Medir custo só em dólar/tokens.** Rejeitado: perde o elo com o pricing e com a
   mensagem de valor. `human_equivalent_hours` custa uma coluna e dá as duas.

## Consequências

### Positivas

- Pipelines de IA cabem no timeout do Deno porque persistem por estágio.
- Reexecução é barata e segura: cache por constraint de unicidade evita LLM
  duplicado; claim atômico evita processamento duplo.
- Custo e valor por empresa ficam mensuráveis desde o dia 1, alinhados ao pricing.
- Fila e retrieval herdam o isolamento por RLS (ADR 0001) sem infra nova.
- Caminho de evolução claro: polling → `pg_notify`/`pg_net`; edge function →
  worker dedicado, sem mudar schema.

### Negativas

- Mais tabelas e triggers para manter (`jobs`, `ai_usage_logs`).
- Idempotência exige disciplina: cada estágio precisa de uma chave de cache correta,
  senão volta a pagar LLM.
- `human_equivalent_hours` é estimativa; se mal calibrada, distorce a leitura de valor.
- Polling por Cron tem latência (segundos) até termos o bridge `pg_notify`/`pg_net`.
- Consumidor precisa tratar job preso em `running` (timeout/heartbeat) — fica como
  próximo passo, não coberto pelo scaffolding inicial.

## Escopo desta rodada (scaffolding)

Esta rodada entrega **só o design (este ADR) + scaffolding de banco**, sem edge
function nova (evita conflito com trabalho paralelo):

- Migration `030_jobs_queue.sql` — tabela `jobs` (fila + estado de pipeline) com RLS
  por `empresa_id`, claim atômico via RPC e trigger `pg_notify('jobs_pending', ...)`.
- Migration `031_ai_usage_logs.sql` — tabela `ai_usage_logs` (custo + equivalente
  humano) com RLS por `empresa_id`.
- Stub de tipos TS em `src/integrations/supabase/ai-jobs.types.ts` (escrito à mão;
  `gen:types` deve ser rodado contra o banco depois de aplicar as migrations).

As migrations **não foram aplicadas em nenhum banco** e `gen:types` **não foi
rodado** nesta rodada.

## Decisões relacionadas

- ADR 0001: Arquitetura multi-tenant via RLS por `empresa_id` (base de toda tabela nova).
- ADR 0004: Observabilidade de Edge Functions (o consumidor de jobs usa `withSentry`).
- ADR 0005: Permissões role + features (quem pode disparar jobs de IA é gate de feature).
- docs/strategy/PRICING.md: o custo de IA em equivalente-humano alimenta o pricing.
- branch `feat/ai-chat-consultivo`: primeiro consumidor do padrão (b) quando sair de
  read-only.
