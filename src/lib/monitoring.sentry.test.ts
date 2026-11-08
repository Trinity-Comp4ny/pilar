import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Caminho com DSN (Sentry ligado). O monitoring.test.ts cobre o modo no-op.
const s = vi.hoisted(() => {
  const scope = { setLevel: vi.fn(), setFingerprint: vi.fn(), setTags: vi.fn() };
  const handlers: Record<string, (arg: unknown) => void> = {};
  return {
    scope,
    handlers,
    init: vi.fn(),
    captureException: vi.fn(() => "evt-123"),
    captureMessage: vi.fn(),
    withScope: vi.fn((fn: (sc: typeof scope) => unknown) => fn(scope)),
    setUser: vi.fn(),
    setTag: vi.fn(),
    addBreadcrumb: vi.fn(),
    sendFeedback: vi.fn(),
    addIntegration: vi.fn(),
    lazyLoadIntegration: vi.fn(),
    browserTracingIntegration: vi.fn(() => "tracing"),
    getClient: vi.fn(() => ({ on: (ev: string, fn: (arg: unknown) => void) => (handlers[ev] = fn) })),
    metrics: { count: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
  };
});

vi.mock("@sentry/react", () => s);
vi.mock("./env", () => ({
  env: { VITE_SENTRY_DSN: "https://key@sentry.test/1", VITE_SENTRY_ENV: "teste" },
  sentryTracesSampleRate: 0.25,
}));
vi.mock("./marketingSite", () => ({ appEnvironmentFromHost: () => null }));

import { initMonitoring, monitoring, OPCOES_REPLAY, reportInvokeError } from "./monitoring";

type InitOpts = {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  beforeSend: (e: Record<string, unknown>) => Record<string, unknown>;
  beforeSendTransaction: (e: Record<string, unknown>) => Record<string, unknown> | null;
};

function opcoesInit(): InitOpts {
  return s.init.mock.calls[0][0] as unknown as InitOpts;
}

beforeEach(() => {
  vi.clearAllMocks();
  s.lazyLoadIntegration.mockImplementation((nome: string) => Promise.resolve((o?: unknown) => ({ nome, o })));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("monitoring com Sentry", () => {
  it("init configura DSN, ambiente, amostragem e integrações preguiçosas", async () => {
    initMonitoring();
    const o = opcoesInit();
    expect(o).toMatchObject({ dsn: "https://key@sentry.test/1", environment: "teste", tracesSampleRate: 0.25 });
    await vi.waitFor(() => expect(s.addIntegration).toHaveBeenCalledTimes(2));
    expect(s.addIntegration).toHaveBeenCalledWith({ nome: "replayIntegration", o: OPCOES_REPLAY });
  });

  it("falha ao carregar integração pela CDN não quebra", async () => {
    s.lazyLoadIntegration.mockRejectedValue(new Error("adblock"));
    expect(() => monitoring.init()).not.toThrow();
    await Promise.resolve();
    expect(s.addIntegration).not.toHaveBeenCalled();
  });

  it("beforeSend mascara URL, dados, extra e state", () => {
    monitoring.init();
    const evento = opcoesInit().beforeSend({
      request: { url: "https://app/cotar/abcdefghijklmnopqrst?x=1", data: { senha: "123", nome: "Ana" } },
      extra: { cpf: "1", obs: "CPF 123.456.789-00" },
      contexts: { state: { token: "t", ok: 1 } },
    });
    expect(evento).toEqual({
      request: { url: "https://app/cotar/[link]?x=1", data: { senha: "***", nome: "Ana" } },
      extra: { cpf: "***", obs: "CPF [CPF]" },
      contexts: { state: { token: "***", ok: 1 } },
    });
    expect(opcoesInit().beforeSend({ message: "sem request" })).toEqual({ message: "sem request" });
  });

  it("beforeSendTransaction descarta rotas públicas e mascara o resto", () => {
    monitoring.init();
    const fn = opcoesInit().beforeSendTransaction;
    expect(fn({ transaction: "/login" })).toBeNull();
    expect(fn({ transaction: "/cotar/abcdefghijklmnopqrst", request: { url: "/cotar/abcdefghijklmnopqrst" } })).toEqual(
      { transaction: "/cotar/[link]", request: { url: "/cotar/[link]" } }
    );
    expect(fn({})).toEqual({});
  });

  it("feedback também passa pelo scrub", () => {
    monitoring.init();
    const fb = { contexts: { feedback: { message: "meu CPF 12345678900", name: "Ana 01310-100" } } };
    s.handlers.beforeSendFeedback(fb);
    expect(fb.contexts.feedback).toEqual({ message: "meu CPF [CPF]", name: "Ana [CEP]" });
    const semNome = { contexts: { feedback: { message: "ok" } } };
    s.handlers.beforeSendFeedback(semNome);
    expect(semNome.contexts.feedback).toEqual({ message: "ok" });
    expect(() => s.handlers.beforeSendFeedback({})).not.toThrow();
  });

  it("captureException simples e com escopo", () => {
    expect(monitoring.captureException(new Error("x"), { senha: "1" })).toBe("evt-123");
    expect(s.captureException).toHaveBeenCalledWith(expect.any(Error), { extra: { senha: "***" } });
    expect(s.withScope).not.toHaveBeenCalled();

    monitoring.captureException(new Error("y"), undefined, {
      level: "warning",
      fingerprint: ["403", "/rota"],
      tags: { area: "fin" },
    });
    expect(s.scope.setLevel).toHaveBeenCalledWith("warning");
    expect(s.scope.setFingerprint).toHaveBeenCalledWith(["403", "/rota"]);
    expect(s.scope.setTags).toHaveBeenCalledWith({ area: "fin" });

    vi.clearAllMocks();
    monitoring.captureException(new Error("z"), {}, {});
    expect(s.scope.setLevel).not.toHaveBeenCalled();
  });

  it("captureMessage, breadcrumb e usuário sem PII", () => {
    monitoring.captureMessage("oi", undefined, { token: "t" });
    expect(s.captureMessage).toHaveBeenCalledWith("oi", { level: "info", extra: { token: "***" } });
    monitoring.addBreadcrumb("clicou", { cnpj: "x" });
    expect(s.addBreadcrumb).toHaveBeenCalledWith({ message: "clicou", data: { cnpj: "***" }, level: "info" });

    monitoring.setUser({ id: "u1", empresa_id: "e1", role: "admin" });
    expect(s.setUser).toHaveBeenCalledWith({ id: "u1" });
    expect(s.setTag).toHaveBeenCalledWith("empresa_id", "e1");
    expect(s.setTag).toHaveBeenCalledWith("role", "admin");
    vi.clearAllMocks();
    monitoring.setUser({ id: "u2" });
    expect(s.setTag).not.toHaveBeenCalled();
    monitoring.setUser(null);
    expect(s.setUser).toHaveBeenLastCalledWith(null);
  });

  it("submitBugFeedback devolve o id, ou nada se falhar ou demorar", async () => {
    s.sendFeedback.mockResolvedValueOnce("fb-1");
    await expect(monitoring.submitBugFeedback("bug", { email: "a@b.c", name: "Ana" })).resolves.toBe("fb-1");
    expect(s.sendFeedback).toHaveBeenCalledWith({ message: "bug", email: "a@b.c", name: "Ana" });

    s.sendFeedback.mockRejectedValueOnce(new Error("adblock"));
    await expect(monitoring.submitBugFeedback("bug")).resolves.toBeUndefined();

    vi.useFakeTimers();
    s.sendFeedback.mockReturnValueOnce(new Promise(() => {}));
    const p = monitoring.submitBugFeedback("lento");
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBeUndefined();
  });

  it("recordMetric escolhe o tipo e mascara tags", () => {
    monitoring.recordMetric("a", 1);
    expect(s.metrics.count).toHaveBeenCalledWith("a", 1, {});
    monitoring.recordMetric("b", 2, { type: "gauge", unit: "ms" });
    expect(s.metrics.gauge).toHaveBeenCalledWith("b", 2, { unit: "ms" });
    monitoring.recordMetric("c", 3, { type: "distribution", tags: { token: "x", rota: "/a" } });
    expect(s.metrics.distribution).toHaveBeenCalledWith("c", 3, { attributes: { token: "***", rota: "/a" } });
  });

  it("reportInvokeError conta 429 como métrica de rate limit", () => {
    expect(reportInvokeError({ context: { status: 429 } }, "ai-chat", { extra: 1 })).toBe("evt-123");
    expect(s.metrics.count).toHaveBeenCalledWith("ai.rate_limited", 1, { attributes: { fn: "ai-chat" } });
    expect(s.captureException).toHaveBeenCalledWith(
      { context: { status: 429 } },
      { extra: { fn: "ai-chat", extra: 1 } }
    );
    vi.clearAllMocks();
    reportInvokeError(new Error("rede"), "x");
    expect(s.metrics.count).not.toHaveBeenCalled();
  });

  it("scrub corta strings longas, listas e profundidade", () => {
    const fundo = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    monitoring.captureException(new Error("x"), {
      longo: "x".repeat(600),
      lista: Array.from({ length: 30 }, (_, i) => i),
      fundo,
      n: 5,
      nulo: null,
    });
    const extra = (s.captureException.mock.calls[0] as unknown[])[1] as { extra: Record<string, unknown> };
    expect((extra.extra.longo as string).length).toBe(501);
    expect(extra.extra.lista).toHaveLength(20);
    expect(JSON.stringify(extra.extra.fundo)).toContain("[max depth]");
    expect(extra.extra.n).toBe(5);
    expect(extra.extra.nulo).toBeNull();
  });
});
