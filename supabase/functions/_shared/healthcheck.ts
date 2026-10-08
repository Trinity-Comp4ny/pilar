/**
 * Helpers para o endpoint /health.
 *
 * Cada checker retorna { status, latency_ms, error? }. Erros são capturados
 * (nunca propagam) — o handler decide o status global a partir dos resultados.
 *
 * Timeouts via AbortController. Sem retries: /health é polled com frequência,
 * retry interno só mascara latência.
 */

export type CheckStatus = "ok" | "degraded" | "down" | "skipped";

export interface CheckResult {
  status: CheckStatus;
  latency_ms: number;
  error?: string;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const onAbort = () => reject(new Error(`timeout after ${ms}ms`));
      signal.addEventListener("abort", onAbort, { once: true });
    }),
  ]);
}

function timed(): { start: number; elapsed: () => number } {
  const start = performance.now();
  return { start, elapsed: () => Math.round(performance.now() - start) };
}

/**
 * Banco via PostgREST com service_role. Consulta uma linha de
 * platform_settings: a raiz /rest/v1/ monta o OpenAPI de 180+ tabelas e
 * passava de 2s a frio, o que dava "down" falso na primeira chamada.
 */
export async function checkDatabase(timeoutMs = 3000): Promise<CheckResult> {
  const t = timed();
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    return { status: "skipped", latency_ms: 0, error: "missing SUPABASE_URL or SERVICE_ROLE_KEY" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await withTimeout(
      fetch(`${url}/rest/v1/platform_settings?select=id&limit=1`, {
        method: "GET",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: ctrl.signal,
      }),
      timeoutMs,
      ctrl.signal
    );
    clearTimeout(timer);
    if (!res.ok) {
      return { status: "down", latency_ms: t.elapsed(), error: `db http ${res.status}` };
    }
    return { status: "ok", latency_ms: t.elapsed() };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "down",
      latency_ms: t.elapsed(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Asaas: HEAD à raiz pública. Falha = degraded (não down — Asaas é opcional).
 */
export async function checkAsaas(timeoutMs = 3000): Promise<CheckResult> {
  const t = timed();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await withTimeout(
      fetch("https://www.asaas.com/api/v3", { method: "HEAD", signal: ctrl.signal }),
      timeoutMs,
      ctrl.signal
    );
    clearTimeout(timer);
    // Qualquer 2xx/4xx = serviço respondendo. 5xx = degraded.
    if (res.status >= 500) {
      return { status: "degraded", latency_ms: t.elapsed(), error: `asaas http ${res.status}` };
    }
    return { status: "ok", latency_ms: t.elapsed() };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "degraded",
      latency_ms: t.elapsed(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Resend: ping ao endpoint público. Falha = degraded.
 */
export async function checkResend(timeoutMs = 3000): Promise<CheckResult> {
  const t = timed();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await withTimeout(
      fetch("https://api.resend.com/", { method: "HEAD", signal: ctrl.signal }),
      timeoutMs,
      ctrl.signal
    );
    clearTimeout(timer);
    if (res.status >= 500) {
      return { status: "degraded", latency_ms: t.elapsed(), error: `resend http ${res.status}` };
    }
    return { status: "ok", latency_ms: t.elapsed() };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "degraded",
      latency_ms: t.elapsed(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Combina resultados em status global:
 *  - qualquer "down" em check crítico (db) -> down
 *  - qualquer "degraded" -> degraded
 *  - resto -> ok
 */
/**
 * Secrets do Vault que os crons precisam (ops_saude_crons). Faltando, os
 * jobs pulam o disparo em silêncio: aqui isso vira "degraded", visível.
 */
export async function checkCrons(timeoutMs = 3000): Promise<CheckResult> {
  const t = timed();
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return { status: "skipped", latency_ms: 0, error: "missing SUPABASE_URL or SERVICE_ROLE_KEY" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await withTimeout(
      fetch(`${url}/rest/v1/rpc/ops_saude_crons`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}",
        signal: ctrl.signal,
      }),
      timeoutMs,
      ctrl.signal
    );
    clearTimeout(timer);
    if (!res.ok) return { status: "degraded", latency_ms: t.elapsed(), error: `crons http ${res.status}` };
    const body = (await res.json()) as { secrets_faltando?: string[] };
    const faltando = body.secrets_faltando ?? [];
    if (faltando.length > 0) {
      return { status: "degraded", latency_ms: t.elapsed(), error: `vault sem ${faltando.join(", ")}` };
    }
    return { status: "ok", latency_ms: t.elapsed() };
  } catch (err) {
    clearTimeout(timer);
    return { status: "degraded", latency_ms: t.elapsed(), error: err instanceof Error ? err.message : String(err) };
  }
}

export function aggregate(results: {
  db: CheckResult;
  asaas?: CheckResult;
  resend?: CheckResult;
  crons?: CheckResult;
}): {
  status: "ok" | "degraded" | "down";
  http: 200 | 503;
} {
  if (results.db.status === "down") return { status: "down", http: 503 };
  const all = [results.db, results.asaas, results.resend, results.crons].filter(Boolean) as CheckResult[];
  if (all.some((r) => r.status === "down" || r.status === "degraded")) {
    return { status: "degraded", http: 200 };
  }
  return { status: "ok", http: 200 };
}
