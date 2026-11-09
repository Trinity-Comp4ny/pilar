import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Armazenamento = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};
type Opts = { auth: { storage: Armazenamento; lock: (n: string, t: number, fn: () => unknown) => unknown } };

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    h.createClient(...args);
    return { auth: { signInWithPassword: h.signIn, signOut: h.signOut } };
  },
}));
vi.mock("./supabaseFetch", () => ({ createInstrumentedFetch: () => "fetch-instrumentado" }));

import { verifyCurrentPassword } from "./supabase";

// O client do app é criado no import. Guarda as opções aqui, no carregamento do arquivo:
// o Vitest 5 limpa o histórico dos mocks antes de cada teste (clearMocks: true por padrão).
const opcoesDoApp = h.createClient.mock.calls[0][2] as Opts & { global: { fetch: unknown } };
const { storage, lock } = opcoesDoApp.auth;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("client Supabase do app", () => {
  it("usa o fetch instrumentado e lock no-op", () => {
    expect(opcoesDoApp.global.fetch).toBe("fetch-instrumentado");
    expect(lock("x", 0, () => 42)).toBe(42);
  });

  it("lembrar-me ligado grava no localStorage", () => {
    storage.setItem("sb", "sessao");
    expect(localStorage.getItem("sb")).toBe("sessao");
    expect(sessionStorage.getItem("sb")).toBeNull();
    expect(storage.getItem("sb")).toBe("sessao");
  });

  it("lembrar-me desligado grava só na sessão da aba", () => {
    localStorage.setItem("pilar-remember-me", "false");
    localStorage.setItem("sb", "velha");
    storage.setItem("sb", "nova");
    expect(sessionStorage.getItem("sb")).toBe("nova");
    expect(localStorage.getItem("sb")).toBeNull();
    expect(storage.getItem("sb")).toBe("nova");
    storage.removeItem("sb");
    expect(storage.getItem("sb")).toBeNull();
  });

  it("storage indisponível não quebra", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(storage.getItem("sb")).toBeNull();
    expect(() => storage.setItem("sb", "x")).not.toThrow();
    expect(() => storage.removeItem("sb")).not.toThrow();
  });
});

describe("verifyCurrentPassword", () => {
  it("senha certa encerra só a sessão de teste", async () => {
    h.signIn.mockResolvedValue({ error: null });
    expect(await verifyCurrentPassword("dev@local.test", "senha")).toBeNull();
    const probe = h.createClient.mock.calls.at(-1)![2] as { auth: { persistSession: boolean } };
    expect(probe.auth.persistSession).toBe(false);
    expect(h.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("senha errada devolve o erro sem sair", async () => {
    h.signOut.mockClear();
    h.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await verifyCurrentPassword("dev@local.test", "x")).toEqual({ message: "Invalid login credentials" });
    expect(h.signOut).not.toHaveBeenCalled();
  });
});
