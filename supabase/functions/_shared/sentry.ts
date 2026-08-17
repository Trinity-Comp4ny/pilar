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
 *   - De propósito SEM `gen_ai.input.messages`/`gen_ai.output.messages`: manda o prompt
 *     completo pro Sentry seria vazar dado de cliente; só token count e modelo.
 *
 * Sem DSN: roda em no-op (apenas console).
 */

import { AsyncLocalStorage } from "node:async_hooks";

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
  attributes: Record<string, string | number | boolean>;
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

const SENSITIVE_KEYS = /password|senha|token|api_key|secret|authorization|cookie|cpf|cnpj/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[max depth]";
  if (value === null || value === undefined) return value;
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
    const sampled = PARSED ? Math.random() < TRACES_RATE : false;
    const startMs = sampled ? Date.now() : 0;
    let response: Response;
    let status: "ok" | "internal_error" = "ok";
    let httpStatus: number | undefined;
    const genAiSpans: GenAiSpanInput[] = [];

    try {
      response = await genAiSpanStore.run(genAiSpans, () => handler(req));
      httpStatus = response.status;
      if (response.status >= 500) status = "internal_error";
    } catch (err) {
      status = "internal_error";
      await captureException(err, {
        fn: fnName,
        tags: { method: req.method },
        extra: { url: req.url },
      });
      response = new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
      httpStatus = 500;
    }

    if (sampled) {
      // fire-and-forget pra não atrasar a resposta
      sendTransaction({
        fnName,
        startMs,
        endMs: Date.now(),
        status,
        httpStatus,
        method: req.method,
        url: req.url,
        genAiSpans,
      }).catch(() => undefined);
    }

    return response;
  };
}
