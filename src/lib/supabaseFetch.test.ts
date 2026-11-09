import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInstrumentedFetch,
  fingerprintFor,
  routeOf,
  redactQuery,
  SupabaseRequestError,
  withAccessToken,
} from "./supabaseFetch";

const captureException = vi.fn((..._args: unknown[]) => "evt-1");
type RefreshResult = { data: { session: { access_token: string } | null }; error: { message: string } | null };
const refreshSession = vi.fn(async (): Promise<RefreshResult> => ({
  data: { session: { access_token: "token-novo" } },
  error: null,
}));

vi.mock("./monitoring", () => ({
  monitoring: {
    captureException: (...args: unknown[]) => captureException(...args),
  },
}));

vi.mock("./supabase", () => ({
  supabase: { auth: { refreshSession: () => refreshSession() } },
}));

const URL_BASE = "https://proj.supabase.co/rest/v1/disciplinas";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

/** Espera o microtask do report, que roda sem await de propósito. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("routeOf", () => {
  it("extrai o path sem query", () => {
    expect(routeOf(`${URL_BASE}?select=id`)).toBe("rest/v1/disciplinas");
  });

  it("não quebra com url inválida", () => {
    expect(routeOf("nao-e-url?x=1")).toBe("nao-e-url");
  });
});

describe("redactQuery", () => {
  it("mantém as chaves e descarta os valores (PII)", () => {
    expect(redactQuery(`${URL_BASE}?email=eq.rafael@mawe.com&select=id`)).toBe("email,select");
  });

  it("devolve undefined sem query", () => {
    expect(redactQuery(URL_BASE)).toBeUndefined();
  });
});

describe("createInstrumentedFetch", () => {
  beforeEach(() => captureException.mockClear());

  it("não reporta resposta ok", async () => {
    const f = createInstrumentedFetch(async () => jsonResponse(200, [{ id: "1" }]));
    const res = await f(URL_BASE);

    expect(res.status).toBe(200);
    await flush();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reporta 403 de RLS como warning agrupado por rota e status", async () => {
    const f = createInstrumentedFetch(async () =>
      jsonResponse(403, {
        code: "42501",
        message: 'new row violates row-level security policy for table "disciplinas"',
      })
    );

    await f(URL_BASE, { method: "POST" });
    await flush();

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, extra, opts] = captureException.mock.calls[0] as unknown as [
      SupabaseRequestError,
      Record<string, unknown>,
      { level: string; fingerprint: string[] },
    ];
    expect(error).toBeInstanceOf(SupabaseRequestError);
    expect(error.message).toBe("POST rest/v1/disciplinas → 403 (42501)");
    expect(extra.status).toBe(403);
    expect(extra.code).toBe("42501");
    expect(opts.level).toBe("warning");
    expect(opts.fingerprint).toEqual(["supabase", "POST", "rest/v1/disciplinas", "403"]);
  });

  it("reporta 5xx como error", async () => {
    const f = createInstrumentedFetch(async () => jsonResponse(500, { message: "boom" }));

    await f(URL_BASE);
    await flush();

    const [, , opts] = captureException.mock.calls[0] as unknown as [unknown, unknown, { level: string }];
    expect(opts.level).toBe("error");
  });

  it("ignora 406 PGRST116 (single sem linha)", async () => {
    const f = createInstrumentedFetch(async () => jsonResponse(406, { code: "PGRST116", message: "no rows" }));

    await f(URL_BASE);
    await flush();

    expect(captureException).not.toHaveBeenCalled();
  });

  it("reporta falha de rede e relança o erro original", async () => {
    const boom = new TypeError("Failed to fetch");
    const f = createInstrumentedFetch(async () => {
      throw boom;
    });

    await expect(f(URL_BASE)).rejects.toBe(boom);
    expect(captureException).toHaveBeenCalledTimes(1);
    const [, extra, opts] = captureException.mock.calls[0] as unknown as [
      unknown,
      { network?: boolean },
      { level: string; fingerprint: string[] },
    ];
    expect(extra.network).toBe(true);
    expect(opts.level).toBe("warning");
    expect(opts.fingerprint).toEqual(["supabase", "network", "GET", "rest/v1/disciplinas"]);
  });

  it("cancelamento (AbortError) relança sem reportar", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    const f = createInstrumentedFetch(async () => {
      throw abort;
    });

    await expect(f(URL_BASE)).rejects.toBe(abort);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("não consome o corpo da resposta que a aplicação vai ler", async () => {
    const f = createInstrumentedFetch(async () => jsonResponse(400, { message: "invalid input" }));

    const res = await f(URL_BASE, { method: "PATCH" });
    await expect(res.json()).resolves.toEqual({ message: "invalid input" });
  });

  it("falha na instrumentação não derruba a chamada", async () => {
    captureException.mockImplementationOnce(() => {
      throw new Error("sentry offline");
    });
    const f = createInstrumentedFetch(async () => jsonResponse(500, { message: "boom" }));

    const res = await f(URL_BASE);
    await flush();
    expect(res.status).toBe(500);
  });

  it("usa o método do Request quando o init não traz um", async () => {
    const f = createInstrumentedFetch(async () => jsonResponse(401, { message: "JWT expired" }));

    await f(new Request(URL_BASE, { method: "DELETE" }));
    await flush();

    const [error] = captureException.mock.calls[0] as unknown as [SupabaseRequestError];
    expect(error.message).toContain("DELETE");
  });
});

describe("retry em JWT rejeitado (PGRST303)", () => {
  beforeEach(() => {
    captureException.mockClear();
    refreshSession.mockClear();
    refreshSession.mockResolvedValue({ data: { session: { access_token: "token-novo" } }, error: null });
  });

  it("renova a sessão e repete a chamada sem reportar falha", async () => {
    let calls = 0;
    const f = createInstrumentedFetch(async () => {
      calls++;
      return calls === 1
        ? jsonResponse(401, { code: "PGRST303", message: "JWT issued at future" })
        : jsonResponse(200, [{ id: "1" }]);
    });

    const res = await f(URL_BASE);
    await flush();

    expect(calls).toBe(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reporta a falha original quando o refresh não resolve", async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "refresh failed" } });
    const f = createInstrumentedFetch(async () =>
      jsonResponse(401, { code: "PGRST303", message: "JWT issued at future" })
    );

    const res = await f(URL_BASE);
    await flush();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("repete com o token renovado, não com o vencido que veio no init", async () => {
    const enviados: (string | null)[] = [];
    const f = createInstrumentedFetch(async (_input, init) => {
      const auth = new Headers(init?.headers).get("Authorization");
      enviados.push(auth);
      return auth === "Bearer token-novo"
        ? jsonResponse(200, [{ id: "1" }])
        : jsonResponse(401, { code: "PGRST303", message: "JWT expired" });
    });

    const res = await f(URL_BASE, { headers: { Authorization: "Bearer token-vencido", apikey: "anon" } });
    await flush();

    expect(enviados).toEqual(["Bearer token-vencido", "Bearer token-novo"]);
    expect(res.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("renova uma vez só quando a tela inteira falha junto", async () => {
    const f = createInstrumentedFetch(async (_input, init) =>
      new Headers(init?.headers).get("Authorization") === "Bearer token-novo"
        ? jsonResponse(200, [])
        : jsonResponse(401, { code: "PGRST303", message: "JWT expired" })
    );
    const init = { headers: { Authorization: "Bearer token-vencido" } };

    const respostas = await Promise.all([f(URL_BASE, init), f(`${URL_BASE}?x=1`, init), f(URL_BASE, init)]);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(respostas.map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it("HEAD de contagem (401 sem corpo) também renova e repete", async () => {
    const f = createInstrumentedFetch(async (_input, init) =>
      new Headers(init?.headers).get("Authorization") === "Bearer token-novo"
        ? new Response(null, { status: 200 })
        : new Response(null, { status: 401 })
    );

    const res = await f(URL_BASE, { method: "HEAD", headers: { Authorization: "Bearer token-vencido" } });
    await flush();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("não mexe em 401 sem o code PGRST303", async () => {
    const f = createInstrumentedFetch(async () => jsonResponse(401, { message: "JWT expired" }));

    await f(URL_BASE);
    await flush();

    expect(refreshSession).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});

describe("withAccessToken", () => {
  it("troca só o Bearer e mantém os outros headers", () => {
    const init = withAccessToken(URL_BASE, { headers: { Authorization: "Bearer velho", apikey: "anon" } }, "novo");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer novo");
    expect(headers.get("apikey")).toBe("anon");
  });

  it("chamada sem Authorization segue como veio", () => {
    const init = { headers: { apikey: "anon" } };
    expect(withAccessToken(URL_BASE, init, "novo")).toBe(init);
  });
});

describe("fingerprintFor", () => {
  it("401 de rotas diferentes cai no mesmo issue", () => {
    expect(fingerprintFor("GET", "rest/v1/projetos", 401, "PGRST303")).toEqual(
      fingerprintFor("HEAD", "rest/v1/pessoas", 401, "PGRST303")
    );
  });

  it("403 continua separado por rota", () => {
    expect(fingerprintFor("GET", "rest/v1/projetos", 403)).not.toEqual(fingerprintFor("GET", "rest/v1/pessoas", 403));
  });
});
