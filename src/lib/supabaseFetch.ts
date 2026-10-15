/**
 * Fetch instrumentado do cliente Supabase (ADR 0030).
 *
 * Todo erro de dado do app atravessa este ponto: REST, RPC, Storage e Auth.
 * Antes, o erro voltava como `{ error }`, a tela fazia `toast.error` e ninguém
 * ficava sabendo: 429 toast.error no app contra 33 captureException, e um
 * design partner levou 11 respostas 403 sem gerar um único evento no Sentry.
 *
 * Regras de calibragem (ver ADR 0030):
 *  - 401/403 são `warning`. 403 agrupa por rota + status (um issue por
 *    endpoint, não um por clique); 401 agrupa por código, porque sessão
 *    inválida derruba a tela inteira de uma vez.
 *  - 5xx e falha de rede são `error`.
 *  - 406 com PGRST116 é `.single()` sem linha, resposta esperada da API: ignora.
 *  - A instrumentação nunca lança nem muda o retorno: se ela falhar, a chamada
 *    original segue como se nada tivesse acontecido.
 */

import { monitoring } from "./monitoring";

/** Erro sintético só para o Sentry ter stack e título estável. */
export class SupabaseRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly route: string
  ) {
    super(message);
    this.name = "SupabaseRequestError";
  }
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/** "https://x.supabase.co/rest/v1/disciplinas?select=id" → "rest/v1/disciplinas" */
export function routeOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname.replace(/^\/+/, "");
  } catch {
    return rawUrl.split("?")[0] ?? rawUrl;
  }
}

/**
 * Mantém as chaves do query e descarta os valores: `?email=eq.rafael@x.com`
 * viraria PII no título do issue.
 */
export function redactQuery(rawUrl: string): string | undefined {
  let search: string;
  try {
    search = new URL(rawUrl).search;
  } catch {
    const idx = rawUrl.indexOf("?");
    search = idx === -1 ? "" : rawUrl.slice(idx);
  }
  if (!search || search === "?") return undefined;
  const keys = Array.from(new URLSearchParams(search).keys());
  return keys.length > 0 ? keys.join(",") : undefined;
}

function levelFor(status: number): "warning" | "error" {
  return status >= 500 ? "error" : "warning";
}

type ErrorBody = { code?: string; message?: string; hint?: string; error?: string; error_description?: string };

async function readErrorBody(res: Response): Promise<ErrorBody> {
  try {
    const text = await res.clone().text();
    if (!text) return {};
    try {
      return JSON.parse(text) as ErrorBody;
    } catch {
      return { message: text.slice(0, 200) };
    }
  } catch {
    return {};
  }
}

/** 406 + PGRST116 é `.single()`/`.maybeSingle()` sem linha: esperado, não é falha. */
function isExpected(status: number, body: ErrorBody): boolean {
  return status === 406 && body.code === "PGRST116";
}

/**
 * 401 + PGRST303 é o PostgREST rejeitando o JWT: vencido (aba ou notebook
 * dormindo pausa o refresh automático) ou com `iat` no futuro (clock skew, corrida
 * de refresh entre abas). `supabase.auth.refreshSession()` troca o token; um retry
 * único com o token novo recupera a chamada sem o usuário perceber, em vez de a
 * tela ficar com dado vazio até um reload manual. HEAD (contagem) volta sem
 * corpo, então o 401 dele chega sem o código e conta como o mesmo caso.
 */
function isRejectedJwt(status: number, method: string, body: ErrorBody): boolean {
  if (status !== 401) return false;
  return body.code === "PGRST303" || (method === "HEAD" && !body.code);
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Renova a sessão uma vez para todas as chamadas que falharem juntas (uma tela
 * dispara 15+ requisições ao mesmo tempo) e devolve o token novo.
 * Import dinâmico: `./supabase` importa este módulo, um import estático criaria ciclo.
 */
async function refreshSessionOnce(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const { supabase } = await import("./supabase");
        const { data, error } = await supabase.auth.refreshSession();
        if (error) return null;
        return data.session?.access_token ?? null;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * O supabase-js põe o `Authorization: Bearer <token>` no `init` antes de chamar
 * este fetch. Repetir com o mesmo `init` reenvia o token vencido e falha de novo,
 * então o retry troca o Bearer pelo token renovado. Chamada sem Authorization
 * segue como veio.
 */
export function withAccessToken(input: FetchInput, init: FetchInit, token: string): FetchInit {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!headers.has("Authorization")) return init;
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Agrupa por rota + status: um issue por endpoint, não um por clique. A exceção é
 * o 401: sessão inválida derruba todas as rotas da tela de uma vez (19 issues de
 * um usuário só em 15/10/2026), então vira um issue por código, com a rota na tag.
 */
export function fingerprintFor(method: string, route: string, status: number, code?: string): string[] {
  if (status === 401) return ["supabase", "auth", "401", code ?? "sem-codigo"];
  return ["supabase", method, route, String(status)];
}

async function reportFailure(res: Response, method: string, url: string): Promise<void> {
  const body = await readErrorBody(res);
  if (isExpected(res.status, body)) return;

  const route = routeOf(url);
  const code = body.code ?? body.error;
  const title = `${method} ${route} → ${res.status}${code ? ` (${code})` : ""}`;

  monitoring.captureException(
    new SupabaseRequestError(title, res.status, route),
    {
      source: "supabase.fetch",
      method,
      route,
      status: res.status,
      query: redactQuery(url),
      code,
      // Mensagem do PostgREST: passa pelo scrub do monitoring antes de sair.
      detail: body.message ?? body.error_description,
      request_id: res.headers.get("x-request-id") ?? undefined,
    },
    {
      level: levelFor(res.status),
      fingerprint: fingerprintFor(method, route, res.status, code),
      tags: { supabase_route: route, supabase_status: String(res.status) },
    }
  );
}

function reportNetworkFailure(err: unknown, method: string, url: string): void {
  // Cancelamento é intencional (React Query aborta a query ao desmontar a tela).
  if (err instanceof DOMException && err.name === "AbortError") return;
  const route = routeOf(url);
  monitoring.captureException(
    err,
    {
      source: "supabase.fetch",
      method,
      route,
      query: redactQuery(url),
      network: true,
    },
    {
      // Queda de conexão do usuário não é acionável um a um; o agrupamento por
      // rota ainda mostra se uma rota específica começa a falhar em volume.
      level: "warning",
      fingerprint: ["supabase", "network", method, route],
      tags: { supabase_route: route, supabase_status: "network" },
    }
  );
}

/**
 * Envolve um `fetch` para reportar toda falha ao Sentry. Recebe o fetch base por
 * parâmetro para o teste poder injetar um dublê.
 */
export function createInstrumentedFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    let res: Response;
    try {
      res = await baseFetch(input, init);
    } catch (err) {
      try {
        reportNetworkFailure(err, method, url);
      } catch {
        /* instrumentação não altera o comportamento da chamada */
      }
      throw err;
    }

    if (res.status === 401) {
      const body = await readErrorBody(res);
      const token = isRejectedJwt(res.status, method, body) ? await refreshSessionOnce() : null;
      if (token) {
        try {
          res = await baseFetch(input, withAccessToken(input, init, token));
        } catch (err) {
          try {
            reportNetworkFailure(err, method, url);
          } catch {
            /* idem */
          }
          throw err;
        }
      }
    }

    if (!res.ok) {
      // Deliberadamente sem await: reportar não deve atrasar a resposta.
      void reportFailure(res, method, url).catch(() => {
        /* idem */
      });
    }

    return res;
  };
}
