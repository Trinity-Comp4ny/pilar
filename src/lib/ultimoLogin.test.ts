import { describe, it, expect, beforeEach, vi } from "vitest";
import { marcarLogin, ultimoMetodo } from "./ultimoLogin";

// jsdom (about:blank) não provisiona localStorage; instalamos um mock em memória.
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

describe("ultimoLogin", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
  });

  it("retorna null quando nunca houve login", () => {
    expect(ultimoMetodo()).toBeNull();
  });

  it("grava e lê o método senha", () => {
    marcarLogin("senha");
    expect(ultimoMetodo()).toBe("senha");
  });

  it("grava e lê o método google", () => {
    marcarLogin("google");
    expect(ultimoMetodo()).toBe("google");
  });

  it("o último método grava sobre o anterior", () => {
    marcarLogin("senha");
    marcarLogin("google");
    expect(ultimoMetodo()).toBe("google");
  });

  it("persiste ts junto do método", () => {
    marcarLogin("google");
    const raw = localStorage.getItem("pilar:ultimo-login");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.metodo).toBe("google");
    expect(typeof parsed.ts).toBe("number");
  });

  it("ignora valor corrompido no storage", () => {
    localStorage.setItem("pilar:ultimo-login", "não é json");
    expect(ultimoMetodo()).toBeNull();
  });

  it("ignora método desconhecido", () => {
    localStorage.setItem("pilar:ultimo-login", JSON.stringify({ metodo: "sms", ts: 1 }));
    expect(ultimoMetodo()).toBeNull();
  });
});
