import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const h = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  breadcrumb: vi.fn(),
  track: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { addBreadcrumb: h.breadcrumb } }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));

import { useDebouncedValue } from "./useDebouncedValue";
import { useMinhaPessoa } from "./useMinhaPessoa";
import { useFeedbackNovosCount } from "./useFeedbackNovosCount";
import { usePageTracking } from "./usePageTracking";
import { usePersistedOpen } from "./usePersistedOpen";
import { useKanbanSort } from "./useKanbanSort";
import { useIsMobile } from "./use-mobile";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  localStorage.clear();
  h.user = { id: "u1" };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("só entrega o último valor depois do atraso", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 100), { initialProps: { v: "a" } });
    rerender({ v: "ab" });
    act(() => vi.advanceTimersByTime(50));
    rerender({ v: "abc" });
    act(() => vi.advanceTimersByTime(99));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("abc");
  });

  it("usa 250ms por padrão", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    act(() => vi.advanceTimersByTime(249));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(2);
  });
});

describe("useMinhaPessoa", () => {
  it("busca a pessoa vinculada ao usuário", async () => {
    supabaseFake.respond("pessoas", "select", { data: { id: "pe1", nome: "Ana" } });
    const { result } = renderHook(() => useMinhaPessoa(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "pe1", nome: "Ana" });
    expect(supabaseFake.calls[0].chain).toContainEqual(["eq", ["profile_id", "u1"]]);
  });

  it("usuário sem pessoa vinculada: null", async () => {
    supabaseFake.respond("pessoas", "select", { data: null });
    const { result } = renderHook(() => useMinhaPessoa(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("propaga erro", async () => {
    supabaseFake.respond("pessoas", "select", { error: { message: "permission denied" } });
    const { result } = renderHook(() => useMinhaPessoa(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("sem usuário não consulta", () => {
    h.user = null;
    const { result } = renderHook(() => useMinhaPessoa(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useFeedbackNovosCount", () => {
  it("conta os feedbacks novos", async () => {
    supabaseFake.respond("feature_suggestions", "select", { count: 4 });
    const { result } = renderHook(() => useFeedbackNovosCount(true), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(4));
    expect(supabaseFake.calls[0].chain).toContainEqual(["eq", ["status_interno", "novo"]]);
  });

  it("count nulo vira zero", async () => {
    const { result } = renderHook(() => useFeedbackNovosCount(true), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(0));
  });

  it("RLS nega (não ultra admin): erro", async () => {
    supabaseFake.respond("feature_suggestions", "select", { error: { message: "permission denied" } });
    const { result } = renderHook(() => useFeedbackNovosCount(true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("desligado não consulta", () => {
    renderHook(() => useFeedbackNovosCount(false), { wrapper });
    expect(supabaseFake.calls).toHaveLength(0);
  });
});

describe("usePageTracking", () => {
  it("registra breadcrumb e pageview com o módulo a cada rota", () => {
    const routerWrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/projetos/1"]}>{children}</MemoryRouter>
    );
    const { result } = renderHook(
      () => {
        usePageTracking();
        return useNavigate();
      },
      { wrapper: routerWrapper }
    );
    expect(h.breadcrumb).toHaveBeenCalledWith("navigation", { path: "/projetos/1" });
    expect(h.track).toHaveBeenCalledWith("$pageview", { path: "/projetos/1", modulo: "projetos" });
    act(() => result.current("/inicio"));
    expect(h.track).toHaveBeenLastCalledWith("$pageview", { path: "/inicio", modulo: null });
  });
});

describe("usePersistedOpen", () => {
  it("usa o padrão e persiste mudanças", () => {
    const { result } = renderHook(() => usePersistedOpen("kpis"));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(localStorage.getItem("pilar.collapsible.kpis")).toBe("0");
    expect(renderHook(() => usePersistedOpen("kpis")).result.current[0]).toBe(false);
  });

  it("padrão fechado e valor salvo '1'", () => {
    expect(renderHook(() => usePersistedOpen("a", false)).result.current[0]).toBe(false);
    localStorage.setItem("pilar.collapsible.b", "1");
    expect(renderHook(() => usePersistedOpen("b", false)).result.current[0]).toBe(true);
  });

  it("storage indisponível: padrão, sem erro", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderHook(() => usePersistedOpen("c", false));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});

describe("useKanbanSort", () => {
  const fallback = { key: "name", dir: "asc" } as const;

  it("lê o valor salvo e persiste o novo", () => {
    localStorage.setItem("pilar.kanban-sort.leads", "value.desc");
    const { result } = renderHook(() => useKanbanSort("leads", fallback, ["name", "value"]));
    expect(result.current[0]).toEqual({ key: "value", dir: "desc" });
    act(() => result.current[1]({ key: "name", dir: "desc" }));
    expect(result.current[0]).toEqual({ key: "name", dir: "desc" });
    expect(localStorage.getItem("pilar.kanban-sort.leads")).toBe("name.desc");
  });

  it("chave salva não suportada pela tela volta ao padrão", () => {
    localStorage.setItem("pilar.kanban-sort.leads", "priority.asc");
    const { result } = renderHook(() => useKanbanSort("leads", fallback, ["name"]));
    expect(result.current[0]).toEqual(fallback);
  });

  it("storage indisponível: padrão e sem erro ao salvar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderHook(() => useKanbanSort("x", fallback, ["name", "value"]));
    expect(result.current[0]).toEqual(fallback);
    act(() => result.current[1]({ key: "value", dir: "asc" }));
    expect(result.current[0]).toEqual({ key: "value", dir: "asc" });
  });
});

describe("useIsMobile", () => {
  const larguraOriginal = window.innerWidth;
  const matchMediaOriginal = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: larguraOriginal });
    window.matchMedia = matchMediaOriginal;
  });

  it("segue a largura e reage ao change do matchMedia", () => {
    const listeners: Array<() => void> = [];
    const remove = vi.fn();
    window.matchMedia = vi.fn(() => ({
      addEventListener: (_: string, l: () => void) => listeners.push(l),
      removeEventListener: remove,
    })) as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    act(() => listeners.forEach((l) => l()));
    expect(result.current).toBe(true);
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("sem matchMedia usa a largura da montagem", () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
