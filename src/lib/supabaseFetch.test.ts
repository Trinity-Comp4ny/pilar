import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInstrumentedFetch, routeOf, redactQuery, SupabaseRequestError } from "./supabaseFetch";

const captureException = vi.fn((..._args: unknown[]) => "evt-1");

vi.mock("./monitoring", () => ({
  monitoring: {
    captureException: (...args: unknown[]) => captureException(...args),
  },
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
      jsonResponse(403, { code: "42501", message: 'new row violates row-level security policy for table "disciplinas"' })
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
    expect(opts.fingerprint).toEqual(["supabase", "network", "GET", "rest/v1/disciplinas"]);
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
