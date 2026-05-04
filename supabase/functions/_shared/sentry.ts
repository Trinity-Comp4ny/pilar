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
 * Sem DSN: roda em no-op (apenas console).
 */

const DSN = Deno.env.get("SENTRY_DSN") ?? "";
const ENVIRONMENT = Deno.env.get("SENTRY_ENV") ?? Deno.env.get("DENO_ENV") ?? "production";
const RELEASE = Deno.env.get("SENTRY_RELEASE") ?? undefined;

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
 * Envolve um handler de Edge Function. Captura exceções não tratadas em Sentry
 * e retorna 500 sem vazar detalhes pro cliente.
 *
 * Uso:
 *   serve(withSentry("asaas-webhook", async (req) => { ... }))
 */
export function withSentry(
  fnName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      await captureException(err, {
        fn: fnName,
        tags: { method: req.method },
        extra: { url: req.url },
      });
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
