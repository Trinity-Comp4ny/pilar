import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Perfil controlável por teste para exercitar o caminho sem profileId.
let mockProfile: { id: string } | null = { id: "user-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: mockProfile }),
}));

import { useNovidades } from "./useNovidades";
import { ULTIMA_VERSAO } from "@/lib/novidades";

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

describe("useNovidades", () => {
  beforeEach(() => {
    mockProfile = { id: "user-1" };
    vi.stubGlobal("localStorage", createLocalStorageMock());
  });

  it("tem novidade quando nunca viu a versão atual", () => {
    const { result } = renderHook(() => useNovidades());
    expect(result.current.temNovidade()).toBe(true);
  });

  it("marcarVista grava a última versão e zera a novidade", () => {
    const { result } = renderHook(() => useNovidades());
    act(() => result.current.marcarVista());

    expect(localStorage.getItem("pilar:novidades-vista:user-1")).toBe(ULTIMA_VERSAO);
    expect(result.current.temNovidade()).toBe(false);
  });

  it("sem novidade quando o localStorage já tem a versão atual na leitura inicial", () => {
    localStorage.setItem("pilar:novidades-vista:user-1", ULTIMA_VERSAO);
    const { result } = renderHook(() => useNovidades());
    expect(result.current.temNovidade()).toBe(false);
  });

  it("volta a ter novidade quando a versão vista é anterior à atual", () => {
    localStorage.setItem("pilar:novidades-vista:user-1", "0.0.1-antiga");
    const { result } = renderHook(() => useNovidades());
    expect(result.current.temNovidade()).toBe(true);
  });

  it("sem profileId não persiste nem sinaliza novidade", () => {
    mockProfile = null;
    const { result } = renderHook(() => useNovidades());

    expect(result.current.temNovidade()).toBe(false);
    act(() => result.current.marcarVista());
    expect(localStorage.length).toBe(0);
    expect(result.current.temNovidade()).toBe(false);
  });
});
