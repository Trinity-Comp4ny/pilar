import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const prefetch = vi.fn<() => Array<Promise<unknown>>>();
vi.mock("@/lib/entradaPrefetch", () => ({ prefetchDaRota: () => prefetch() }));

import { useEntradaPronta, TETO_ENTRADA_MS } from "./useEntradaPronta";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("useEntradaPronta", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("não segura nada sem empresa", () => {
    prefetch.mockReturnValue([]);
    const { result } = renderHook(() => useEntradaPronta(undefined, "/projetos", undefined), { wrapper });
    expect(result.current).toBe(true);
  });

  it("segura o véu até os dados chegarem", async () => {
    let fim!: () => void;
    prefetch.mockReturnValue([new Promise<void>((r) => (fim = r))]);
    const { result } = renderHook(() => useEntradaPronta("e1", "/projetos", "u1"), { wrapper });
    expect(result.current).toBe(false);
    await act(async () => {
      fim();
    });
    expect(result.current).toBe(true);
  });

  it("libera no teto mesmo se os dados não chegam", async () => {
    prefetch.mockReturnValue([new Promise(() => {})]);
    const { result } = renderHook(() => useEntradaPronta("e1", "/projetos", "u1"), { wrapper });
    expect(result.current).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(TETO_ENTRADA_MS + 10);
    });
    expect(result.current).toBe(true);
  });

  it("libera na hora quando a rota não tem pré-carregamento", async () => {
    prefetch.mockReturnValue([]);
    const { result } = renderHook(() => useEntradaPronta("e1", "/outra", "u1"), { wrapper });
    await act(async () => {});
    expect(result.current).toBe(true);
  });
});
