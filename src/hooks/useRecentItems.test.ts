import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Perfil fixo para namespacing das chaves de localStorage.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { id: "user-1" } }),
}));

import { useRecentItems, type RecentItemInput } from "./useRecentItems";

const item = (over: Partial<RecentItemInput> = {}): RecentItemInput => ({
  tipo: "cliente",
  id: "c1",
  label: "Cliente 1",
  rota: "/gestao/clientes/c1",
  ...over,
});

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

describe("useRecentItems", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
  });

  it("registra recente e persiste com chave por usuário", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.record(item()));

    expect(result.current.recentes()).toHaveLength(1);
    expect(result.current.recentes()[0]).toMatchObject({ tipo: "cliente", id: "c1" });
    const raw = localStorage.getItem("pilar:recentes:user-1");
    expect(raw).toBeTruthy();
  });

  it("aplica FIFO com cap de 8, mais recente no topo", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.record(item({ id: `p${i}`, tipo: "projeto", label: `Projeto ${i}` }));
      }
    });

    const recs = result.current.recentes();
    expect(recs).toHaveLength(8);
    expect(recs[0].id).toBe("p9");
    expect(recs.some((r) => r.id === "p0")).toBe(false);
  });

  it("dedupa por tipo+id e move para o topo", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => {
      result.current.record(item({ id: "a", tipo: "projeto" }));
      result.current.record(item({ id: "b", tipo: "projeto" }));
      result.current.record(item({ id: "a", tipo: "projeto" }));
    });

    const recs = result.current.recentes();
    expect(recs).toHaveLength(2);
    expect(recs[0].id).toBe("a");
  });

  it("distingue mesmo id em tipos diferentes", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => {
      result.current.record(item({ id: "x", tipo: "cliente" }));
      result.current.record(item({ id: "x", tipo: "projeto" }));
    });

    expect(result.current.recentes()).toHaveLength(2);
  });

  it("alterna favorito e reflete em isFavorito", () => {
    const { result } = renderHook(() => useRecentItems());
    const fav = item({ id: "f1", tipo: "cliente" });

    expect(result.current.isFavorito(fav)).toBe(false);
    act(() => result.current.toggleFavorito(fav));
    expect(result.current.isFavorito(fav)).toBe(true);
    expect(result.current.favoritos()).toHaveLength(1);

    act(() => result.current.toggleFavorito(fav));
    expect(result.current.isFavorito(fav)).toBe(false);
    expect(result.current.favoritos()).toHaveLength(0);
  });

  it("lê o estado inicial do localStorage já existente", () => {
    localStorage.setItem(
      "pilar:favoritos:user-1",
      JSON.stringify([{ tipo: "projeto", id: "p1", label: "Projeto 1", rota: "/projetos/p1", ts: 1 }])
    );
    const { result } = renderHook(() => useRecentItems());
    expect(result.current.isFavorito({ tipo: "projeto", id: "p1" })).toBe(true);
  });
});
