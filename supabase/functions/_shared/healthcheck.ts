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

/**
 * Autenticação (GoTrue). Fora do ar = ninguém entra no app: "down".
 */
export async function checkAuth(timeoutMs = 3000): Promise<CheckResult> {
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
      fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: ctrl.signal }),
      timeoutMs,
      ctrl.signal
    );
    clearTimeout(timer);
    if (!res.ok) return { status: "down", latency_ms: t.elapsed(), error: `auth http ${res.status}` };
    return { status: "ok", latency_ms: t.elapsed() };
  } catch (err) {
    clearTimeout(timer);
    return { status: "down", latency_ms: t.elapsed(), error: err instanceof Error ? err.message : String(err) };
  }
}

/** Contagem de um componente na janela, como devolvida por public._ops_sinais_saude(). */
export interface ContagemSinal {
  ok: number;
  falhas: number;
  ultimo_ok?: string | null;
  ultima_falha?: string | null;
  disponivel?: boolean;
}

export interface Sinais {
  emails?: ContagemSinal;
  pagamentos?: ContagemSinal;
  ia?: ContagemSinal;
  crons?: ContagemSinal;
}

/**
 * Decide a saúde de um componente pelo que aconteceu de fato (SPEC 105).
 *
 * O volume de hoje é baixo (dezenas de eventos por semana), então taxa de erro daria
 * ruído: uma falha em duas tentativas seria "50% de erro". A regra é:
 *  - sem dado (pg_cron ausente, RPC fora) → "skipped", não pesa no status geral;
 *  - nenhuma falha → "ok";
 *  - `limite` falhas ou mais na janela → "degraded";
 *  - falha mais recente que o último sucesso (quebrou e não voltou) → "degraded";
 *  - falha isolada com sucesso depois → "ok" (já se recuperou);
 *  - `exigeAtividade` (crons): nenhuma execução na janela → "degraded". O pg_cron tem
 *    jobs de hora em hora; 24 h sem nada é o agendador parado, não falta de uso.
 */
export function avaliarSinal(
  c: ContagemSinal | undefined,
  limite: number,
  { exigeAtividade = false }: { exigeAtividade?: boolean } = {}
): CheckStatus {
  if (!c || c.disponivel === false) return "skipped";
  if (exigeAtividade && !c.ok && !c.falhas) return "degraded";
  if (!c.falhas) return "ok";
  if (c.falhas >= limite) return "degraded";
  if (!c.ultimo_ok) return "degraded";
  if (c.ultima_falha && new Date(c.ultima_falha) > new Date(c.ultimo_ok)) return "degraded";
  return "ok";
}

/** Contagens por componente via RPC interna (service_role). null se não der para ler. */
export async function buscarSinais(timeoutMs = 3000): Promise<Sinais | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await withTimeout(
      fetch(`${url}/rest/v1/rpc/_ops_sinais_saude`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}",
        signal: ctrl.signal,
      }),
      timeoutMs,
      ctrl.signal
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as Sinais;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Componentes da status page (SPEC 105). A ordem é a de exibição. */
export const COMPONENTES = ["api", "banco", "autenticacao", "pagamentos", "emails", "ia", "crons"] as const;
export type Componente = (typeof COMPONENTES)[number];

const PESO: Record<CheckStatus, number> = { skipped: 0, ok: 1, degraded: 2, down: 3 };

/** O pior de vários status; "skipped" só vence se não houver mais nada. */
export function pior(...status: (CheckStatus | undefined)[]): CheckStatus {
  return status
    .filter((s): s is CheckStatus => Boolean(s))
    .reduce<CheckStatus>((acc, s) => (PESO[s] > PESO[acc] ? s : acc), "skipped");
}

/** Componentes cuja queda tira o app do ar (ninguém entra ou nada carrega). */
const CRITICOS: Componente[] = ["banco", "autenticacao"];

/**
 * Resposta do /health. Com `componentePedido`, o HTTP reflete só aquele componente
 * (503 se não estiver ok): é o que cada monitor da status page consulta. Sem ele, 503
 * só quando um componente crítico está fora.
 */
export function montarResposta(
  componentes: Record<Componente, CheckStatus>,
  componentePedido: string | null
): { http: 200 | 400 | 503; status: "ok" | "degraded" | "down"; erro?: string } {
  const geral = pior(...COMPONENTES.map((c) => componentes[c]));
  const status = CRITICOS.some((c) => componentes[c] === "down")
    ? "down"
    : geral === "down" || geral === "degraded"
      ? "degraded"
      : "ok";

  if (componentePedido !== null) {
    if (!(COMPONENTES as readonly string[]).includes(componentePedido)) {
      return { http: 400, status, erro: `componente desconhecido; use um de: ${COMPONENTES.join(", ")}` };
    }
    const s = componentes[componentePedido as Componente];
    return { http: s === "ok" || s === "skipped" ? 200 : 503, status };
  }

  return { http: status === "down" ? 503 : 200, status };
}
