/**
 * Sentry para Edge Functions — envia erros via HTTP envelope (sem SDK).
 *
 * Por que envelope direto: SDK Deno do Sentry traz dependências pesadas
 * (Node compat shims, integrations não usadas no edge runtime). Envelope
 * é uma única chamada fetch, zero deps, e é estável desde 2020.
 *
 * Ativação: setar `SENTRY_DSN` nos secrets do Supabase.
 *   supabase secrets set SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
 *
 * Performance Monitoring (transactions):
 *   - SENTRY_TRACES_RATE (default 0.1) — fração de invocações enviadas como transaction.
 *   - Cada transaction tem op="edge.function", name=fnName, duração medida via Date.now().
 *
 * AI Agent Monitoring (dashboard Insights > Agents):
 *   - recordGenAiSpan() registra spans `gen_ai.*` (convenção OTel Gen AI que o Sentry lê
 *     pra popular o dashboard de agentes: modelo, tokens, custo, execuções).
 *   - Cada invocação de withSentry abre um AsyncLocalStorage novo pra coletar os spans
 *     chamados durante aquele request (ex.: em ai-client.ts), sem precisar passar
 *     contexto manualmente pelos 14 handlers `ai-*`.
 *   - Inclui `gen_ai.input.messages`/`gen_ai.output.messages` (replay de conversa em
 *     Insights > Agents), passado por scrub() antes de sair (ver ADR 0027). Trade-off
 *     aceito conscientemente: conteúdo de conversa passa a trafegar pro Sentry.
 *   - `gen_ai.conversation.id` (setado pelo caller) agrupa spans da mesma conversa na
 *     tela Conversations. `setSentryUser()` identifica quem está por trás da conversa.
 *
 * Application Metrics (dashboard Explore > Metrics):
 *   - recordMetric() manda um envelope `trace_metric` (contador/gauge/distribuição,
 *     ver ADR 0027). Não é amostrado por SENTRY_TRACES_RATE: métrica agregada perde
 *     precisão se for sampleada como uma trace.
 *
 * Sem DSN: roda em no-op (apenas console).
 */

import { AsyncLocalStorage } from "node:async_hooks";

// `EdgeRuntime` só existe no runtime do Supabase (e no `supabase functions serve`
// local); em `deno check`/testes fora dele, cai no fallback (a promise ainda roda,
// só sem a garantia de sobreviver ao fim da resposta).
declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

function waitUntil(promise: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(promise);
  }
}

const DSN = Deno.env.get("SENTRY_DSN") ?? "";
const ENVIRONMENT = Deno.env.get("SENTRY_ENV") ?? Deno.env.get("DENO_ENV") ?? "production";
const RELEASE = Deno.env.get("SENTRY_RELEASE") ?? undefined;
const TRACES_RATE = (() => {
  const raw = Number(Deno.env.get("SENTRY_TRACES_RATE") ?? "0.1");
  if (!Number.isFinite(raw) || raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
})();

interface ParsedDsn {
  host: string;
  projectId: string;
  publicKey: string;
  envelopeUrl: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !projectId) return null;
    return {
      host: u.host,
      projectId,
      publicKey: u.username,
      envelopeUrl: `${u.protocol}//${u.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

const PARSED = parseDsn(DSN);

export interface SentryContext {
  fn?: string;
  user?: { id?: string; empresa_id?: string };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/** Span `gen_ai.*` (convenção OTel Gen AI). Ver recordGenAiSpan. */
export interface GenAiSpanInput {
  op: "gen_ai.chat" | "gen_ai.invoke_agent" | "gen_ai.execute_tool";
  name: string;
  // unknown (não só string|number|boolean) porque gen_ai.input.messages/output.messages
  // carregam array de {role, content}, não um valor primitivo.
  attributes: Record<string, unknown>;
  startMs: number;
  endMs: number;
  status?: "ok" | "error";
}

const genAiSpanStore = new AsyncLocalStorage<GenAiSpanInput[]>();

/**
 * Registra um span gen_ai.* pra aparecer no dashboard Insights > Agents do Sentry.
 * Só tem efeito dentro do ciclo de vida de um handler envolvido por withSentry
 * (fora disso, getStore() é undefined e a chamada é um no-op silencioso).
 */
export function recordGenAiSpan(span: GenAiSpanInput): void {
  genAiSpanStore.getStore()?.push(span);
}

export interface SentryUserInfo {
  id?: string;
  email?: string;
  empresa_id?: string;
}

const sentryUserStore = new AsyncLocalStorage<{ value?: SentryUserInfo }>();

/**
 * Identifica o usuário/empresa da invocação atual, pra popular a coluna "User" do
 * dashboard Conversations (Insights > Agents) do Sentry (ver ADR 0027). Chamar dentro
 * de um handler envolvido por withSentry, assim que o usuário for resolvido (ex.: logo
 * após auth.getUser()). Sem efeito fora desse ciclo de vida (no-op silencioso).
 */
export function setSentryUser(user: SentryUserInfo): void {
  const box = sentryUserStore.getStore();
  if (box) box.value = user;
}

const SENSITIVE_KEYS = /password|senha|token|api_key|secret|authorization|cookie|cpf|cnpj/i;

// Padrões PII brasileiros: mascarados em valores string mesmo quando a key é benigna
// (relevante pro conteúdo livre de gen_ai.input.messages/output.messages). Espelha
// src/lib/monitoring.ts (runtime separado, Deno edge não importa código do Vite app).
const PII_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replace: "[CPF]" },
  { re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replace: "[CNPJ]" },
  { re: /\b\d{5}-?\d{3}\b/g, replace: "[CEP]" },
  { re: /\b(?:\d[ -]?){13,16}\d\b/g, replace: "[CARD]" },
];

function scrubString(s: string): string {
  let out = s;
  for (const { re, replace } of PII_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

/** Mascara chaves sensíveis e padrões de PII brasileiros em qualquer valor aninhado. */
export function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[max depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.test(k) ? "***" : scrub(v, depth + 1);
  }
  return out;
}

function genEventId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildException(err: unknown) {
  if (err instanceof Error) {
    const frames = (err.stack ?? "")
      .split("\n")
      .slice(1)
      .map((line) => ({ filename: line.trim() }))
      .filter((f) => f.filename);
    return {
      values: [
        {
          type: err.name || "Error",
          value: String(err.message ?? ""),
          stacktrace: { frames: frames.reverse() },
        },
      ],
    };
  }
  return { values: [{ type: "NonError", value: String(err) }] };
}

export async function captureException(err: unknown, ctx: SentryContext = {}): Promise<void> {
  if (!PARSED) return;

  const eventId = genEventId();
  const timestamp = new Date().toISOString();

  const event = {
    event_id: eventId,
    timestamp,
    platform: "javascript",
    level: "error",
    environment: ENVIRONMENT,
    release: RELEASE,
    server_name: ctx.fn,
    tags: { runtime: "deno-edge", ...(ctx.fn && { fn: ctx.fn }), ...(ctx.tags ?? {}) },
    user: ctx.user ? { id: ctx.user.id, segment: ctx.user.empresa_id } : undefined,
    extra: ctx.extra ? (scrub(ctx.extra) as Record<string, unknown>) : undefined,
    exception: buildException(err),
  };

  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    sent_at: timestamp,
    dsn: DSN,
  });
  const itemHeader = JSON.stringify({ type: "event" });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;

  try {
    const res = await fetch(PARSED.envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${PARSED.publicKey}, sentry_client=pilar-edge/1.0`,
      },
      body,
    });
    if (!res.ok) {
      console.warn(`[sentry] envelope rejected ${res.status}`);
    }
  } catch (e) {
    console.warn(`[sentry] failed to send: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Envia uma transaction (Performance) como envelope Sentry.
 * Transaction = um span raiz com timing start/end.
 */
async function sendTransaction(params: {
  fnName: string;
  startMs: number;
  endMs: number;
  status: "ok" | "internal_error";
  httpStatus?: number;
  method?: string;
  url?: string;
  genAiSpans?: GenAiSpanInput[];
  user?: SentryUserInfo;
}): Promise<void> {
  if (!PARSED) return;

  const eventId = genEventId();
  const traceId = crypto.randomUUID().replace(/-/g, "");
  const spanId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const sentAt = new Date().toISOString();
  const startTs = params.startMs / 1000;
  const endTs = params.endMs / 1000;

  const spans = (params.genAiSpans ?? []).map((s) => ({
    span_id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    trace_id: traceId,
    parent_span_id: spanId,
    op: s.op,
    description: s.name,
    start_timestamp: s.startMs / 1000,
    timestamp: s.endMs / 1000,
    status: s.status ?? "ok",
    data: s.attributes,
  }));

  const event = {
    event_id: eventId,
    type: "transaction",
    transaction: params.fnName,
    platform: "javascript",
    environment: ENVIRONMENT,
    release: RELEASE,
    server_name: params.fnName,
    timestamp: endTs,
    start_timestamp: startTs,
    user: params.user ? { id: params.user.id, email: params.user.email, segment: params.user.empresa_id } : undefined,
    tags: {
      runtime: "deno-edge",
      fn: params.fnName,
      ...(params.method && { method: params.method }),
      ...(params.httpStatus && { http_status: String(params.httpStatus) }),
    },
    contexts: {
      trace: {
        trace_id: traceId,
        span_id: spanId,
        op: "edge.function",
        status: params.status,
        ...(params.url && { data: { "http.url": params.url } }),
      },
    },
    spans,
  };

  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn: DSN });
  const itemHeader = JSON.stringify({ type: "transaction" });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;

  try {
    const res = await fetch(PARSED.envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${PARSED.publicKey}, sentry_client=pilar-edge/1.0`,
      },
      body,
    });
    if (!res.ok) console.warn(`[sentry] tx envelope rejected ${res.status}`);
  } catch (e) {
    console.warn(`[sentry] tx failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Envolve um handler de Edge Function. Captura exceções não tratadas em Sentry,
 * registra uma transaction (Performance) com sampling, e retorna 500 sem vazar
 * detalhes pro cliente.
 *
 * Uso:
 *   serve(withSentry("asaas-webhook", async (req) => { ... }))
 */
export function withSentry(
  fnName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Amostragem de performance (custo): só uma fração das invocações vira transaction
    // "normal". Mas se a invocação gerou spans gen_ai.* (Insights > Agents), a transaction
    // sempre sai (genAiSpans.length > 0 abaixo), senão o dashboard de agentes perderia ~90%
    // das execuções por causa de uma amostragem que não tem relação com agent monitoring.
    const performanceSampled = PARSED ? Math.random() < TRACES_RATE : false;
    const startMs = Date.now();
    let response: Response;
    let status: "ok" | "internal_error" = "ok";
    let httpStatus: number | undefined;
    const genAiSpans: GenAiSpanInput[] = [];
    const userBox: { value?: SentryUserInfo } = {};

    try {
      response = await sentryUserStore.run(userBox, () => genAiSpanStore.run(genAiSpans, () => handler(req)));
      httpStatus = response.status;
      if (response.status >= 500) status = "internal_error";
    } catch (err) {
      status = "internal_error";
      await captureException(err, {
        fn: fnName,
        tags: { method: req.method },
        extra: { url: req.url },
        user: userBox.value,
      });
      response = new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
      httpStatus = 500;
    }

    if (performanceSampled || genAiSpans.length > 0) {
      // Fire-and-forget pra não atrasar a resposta, mas SEM waitUntil o isolate do
      // edge-runtime pode congelar assim que a Response é retornada, matando o fetch
      // do envelope no meio (transaction nunca chega no Sentry). EdgeRuntime.waitUntil
      // é o mecanismo do próprio runtime da Supabase (mesma ideia do ctx.waitUntil do
      // Cloudflare Workers) pra manter a promise viva depois da resposta.
      const task = sendTransaction({
        fnName,
        startMs,
        endMs: Date.now(),
        status,
        user: userBox.value,
        httpStatus,
        method: req.method,
        url: req.url,
        genAiSpans,
      }).catch(() => undefined);
      waitUntil(task);
    }

    return response;
  };
}

export type MetricType = "counter" | "gauge" | "distribution";

/**
 * Registra uma métrica de aplicação (dashboard Explore > Metrics) via envelope
 * `trace_metric`. Fire-and-forget (waitUntil), nunca atrasa nem quebra o handler.
 *
 * Sem trace/span pai: cada chamada gera um trace_id próprio (SDKs do Sentry aceitam
 * misturar métricas de traces diferentes no mesmo envelope), o que é suficiente pra
 * agregação numérica, não precisamos correlacionar com a transaction da request.
 */
export function recordMetric(
  name: string,
  value: number,
  opts: { type?: MetricType; unit?: string; tags?: Record<string, string | number | boolean> } = {}
): void {
  if (!PARSED) return;

  const attributes: Record<string, { value: string | number | boolean; type: string }> | undefined = opts.tags
    ? Object.fromEntries(
        Object.entries(scrub(opts.tags) as Record<string, string | number | boolean>).map(([k, v]) => [
          k,
          {
            value: v,
            type: typeof v === "boolean" ? "boolean" : typeof v === "number" ? "double" : "string",
          },
        ])
      )
    : undefined;

  const item = {
    timestamp: Date.now() / 1000,
    trace_id: crypto.randomUUID().replace(/-/g, ""),
    name,
    type: opts.type ?? "counter",
    value,
    ...(opts.unit && { unit: opts.unit }),
    ...(attributes && { attributes }),
  };

  const eventId = genEventId();
  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: DSN });
  const itemHeader = JSON.stringify({
    type: "trace_metric",
    item_count: 1,
    content_type: "application/vnd.sentry.items.trace-metric+json",
  });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify({ items: [item] })}`;

  const task = fetch(PARSED.envelopeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${PARSED.publicKey}, sentry_client=pilar-edge/1.0`,
    },
    body,
  })
    .then((res) => {
      if (!res.ok) console.warn(`[sentry] metric envelope rejected ${res.status}`);
    })
    .catch((e) => {
      console.warn(`[sentry] metric failed to send: ${e instanceof Error ? e.message : String(e)}`);
    });
  waitUntil(task);
}
