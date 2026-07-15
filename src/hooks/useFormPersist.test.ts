import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormPersist, clearFormPersist } from "./useFormPersist";

const KEY = "test-form";
const STORAGE_KEY = "pilar-form:test-form";

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

describe("useFormPersist", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("persiste valores no localStorage a cada mudança", () => {
    const onRestore = vi.fn();
    const { rerender } = renderHook(
      ({ values }) => useFormPersist({ storageKey: KEY, values, onRestore }),
      { initialProps: { values: { nome: "" } } },
    );

    rerender({ values: { nome: "Ana" } });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).values).toEqual({ nome: "Ana" });
  });

  it("restaura um rascunho válido no mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { nome: "Bruno" }, step: 2, savedAt: Date.now() }),
    );
    const onRestore = vi.fn();

    renderHook(() => useFormPersist({ storageKey: KEY, values: { nome: "" }, onRestore }));

    expect(onRestore).toHaveBeenCalledWith({ values: { nome: "Bruno" }, step: 2 });
  });

  it("descarta rascunho expirado (fora do TTL) e não restaura", () => {
    const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { nome: "Velho" }, savedAt: twentyFiveHoursAgo }),
    );
    const onRestore = vi.fn();

    renderHook(() => useFormPersist({ storageKey: KEY, values: { nome: "" }, onRestore, ttlHours: 24 }));

    expect(onRestore).not.toHaveBeenCalled();
    // O rascunho vencido foi descartado (não sobrevive como "Velho").
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain("Velho");
  });

  it("descarta snapshot corrompido sem lançar erro", () => {
    localStorage.setItem(STORAGE_KEY, "{ isto não é json válido");
    const onRestore = vi.fn();

    expect(() =>
      renderHook(() => useFormPersist({ storageKey: KEY, values: { nome: "" }, onRestore })),
    ).not.toThrow();

    expect(onRestore).not.toHaveBeenCalled();
    // Após descartar o lixo, o hook volta a persistir JSON válido do form atual.
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(() => JSON.parse(raw!)).not.toThrow();
    expect(JSON.parse(raw!).values).toEqual({ nome: "" });
  });

  it("não persiste nem restaura quando enabled=false", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { nome: "Ignorado" }, savedAt: Date.now() }),
    );
    const onRestore = vi.fn();

    const { rerender } = renderHook(
      ({ values }) => useFormPersist({ storageKey: KEY, values, onRestore, enabled: false }),
      { initialProps: { values: { nome: "" } } },
    );
    rerender({ values: { nome: "Novo" } });

    expect(onRestore).not.toHaveBeenCalled();
    // O rascunho original permanece intocado.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).values).toEqual({ nome: "Ignorado" });
  });

  it("clearFormPersist remove o rascunho", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ values: {}, savedAt: Date.now() }));
    clearFormPersist(KEY);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
