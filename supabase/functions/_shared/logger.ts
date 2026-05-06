/**
 * Structured logger para Edge Functions.
 *
 * Por que: console.error sem contexto é arqueologia em produção.
 * Este logger emite JSON com timestamp + função + nível + contexto + erro,
 * permitindo filtrar logs no Supabase Dashboard ou exportar pra Sentry/Datadog.
 *
 * Erros (`log.error`) são automaticamente forwardeados pro Sentry quando
 * `SENTRY_DSN` está setado — sem opt-in, todas funções que já usam logger
 * ganham observabilidade.
 *
 * Uso:
 *   const log = createLogger("invite-user", { empresa_id, user_id });
 *   log.info("invite created", { email });
 *   log.error("rpc failed", err, { rpc: "create_convite" });
 */

import { captureException } from "./sentry.ts";

type LogLevel = "debug" | "info" | "warn" | "error";

type Context = Record<string, unknown>;

const PII_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replace: "[CPF]" },
  { re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replace: "[CNPJ]" },
  { re: /\b\d{5}-?\d{3}\b/g, replace: "[CEP]" },
];

const SENSITIVE_KEYS = /password|senha|token|api_key|secret|authorization|cookie|cpf|cnpj/i;

function scrubString(s: string): string {
  let out = s;
  for (const { re, replace } of PII_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

function scrub(value: unknown, depth = 0): unknown {
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

export interface Logger {
  debug(msg: string, extra?: Context): void;
  info(msg: string, extra?: Context): void;
  warn(msg: string, extra?: Context): void;
  error(msg: string, err?: unknown, extra?: Context): void;
  child(extra: Context): Logger;
}

export function createLogger(fnName: string, baseCtx: Context = {}): Logger {
  function emit(level: LogLevel, msg: string, extra?: Context, err?: unknown) {
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      fn: fnName,
      msg,
      ...(scrub(baseCtx) as Context),
      ...(extra ? (scrub(extra) as Context) : {}),
    };
    if (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      entry.error = { name: e.name, message: scrubString(e.message), stack: e.stack };
    }
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
      // Forward pro Sentry — fire-and-forget, não bloqueia handler
      captureException(err ?? new Error(msg), {
        fn: fnName,
        extra: { msg, ...(scrub(baseCtx) as Context), ...(extra ? (scrub(extra) as Context) : {}) },
      }).catch(() => {});
    } else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  return {
    debug: (msg, extra) => emit("debug", msg, extra),
    info: (msg, extra) => emit("info", msg, extra),
    warn: (msg, extra) => emit("warn", msg, extra),
    error: (msg, err, extra) => emit("error", msg, extra, err),
    child(extra) {
      return createLogger(fnName, { ...baseCtx, ...extra });
    },
  };
}
