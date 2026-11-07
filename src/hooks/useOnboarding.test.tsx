import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

const h = vi.hoisted(() => ({
  profile: { empresa_id: "emp-1" } as Record<string, unknown> | null,
  refreshProfile: vi.fn(),
  liberadas: new Set<string>(),
  isAdmin: true,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: h.profile, refreshProfile: h.refreshProfile }),
}));
const can = (f: string) => h.liberadas.has(f);
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can, isAdmin: h.isAdmin }) }));

// Um passo extra sem soft delete, para exercitar a contagem sem filtro de deleted_at.
vi.mock("@/lib/onboarding/steps", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/onboarding/steps")>();
  const base = orig.ONBOARDING_STEPS[0];
  return {
    ...orig,
    ONBOARDING_STEPS: [
      ...orig.ONBOARDING_STEPS,
      { ...base, id: "extra-sem-soft-delete", feature: "extra", count: { source: "extra_src", softDelete: false } },
    ],
  };
});

import { useOnboardingProgress } from "./useOnboardingProgress";
import { useOnboardingState } from "./useOnboardingState";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  h.profile = { empresa_id: "emp-1" };
  h.liberadas = new Set(["clientes", "projetos", "pessoas", "extra"]);
  h.isAdmin = true;
  h.refreshProfile.mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useOnboardingProgress", () => {
  it("conta cada fonte visível por empresa e marca passos concluídos", async () => {
    supabaseFake.respond("clientes", "select", { count: 3 });
    supabaseFake.respond("extra_src", "select", { count: null });
    const { result } = renderHook(() => useOnboardingProgress(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasEmpresa).toBe(true);
    const done = Object.fromEntries(result.current.steps.map((s) => [s.count.source, s.done]));
    expect(done.clientes).toBe(true);
    expect(done.projetos).toBe(false);
    expect(done.extra_src).toBe(false);
    expect(done).not.toHaveProperty("obras");

    const clientes = supabaseFake.callsTo("clientes")[0].chain;
    expect(clientes).toContainEqual(["eq", ["empresa_id", "emp-1"]]);
    expect(clientes).toContainEqual(["is", ["deleted_at", null]]);
    const extra = supabaseFake.callsTo("extra_src")[0].chain;
    expect(extra.some(([m]) => m === "is")).toBe(false);
  });

  it("não-admin não vê passo adminOnly (pessoas)", async () => {
    h.isAdmin = false;
    const { result } = renderHook(() => useOnboardingProgress(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.steps.some((s) => s.count.source === "pessoas")).toBe(false);
    expect(supabaseFake.callsTo("pessoas")).toHaveLength(0);
  });

  it("sem empresa: não consulta", () => {
    h.profile = null;
    const { result } = renderHook(() => useOnboardingProgress(), { wrapper });
    expect(result.current.hasEmpresa).toBe(false);
    expect(result.current.doneSteps).toBe(0);
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("nenhuma feature liberada: sem passos e sem consulta", () => {
    h.liberadas = new Set();
    const { result } = renderHook(() => useOnboardingProgress(), { wrapper });
    expect(result.current.totalSteps).toBe(0);
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("erro numa contagem: nada concluído", async () => {
    supabaseFake.respond("clientes", "select", { error: { message: "permission denied" } });
    const { result } = renderHook(() => useOnboardingProgress(), { wrapper });
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe("error"));
    expect(result.current.doneSteps).toBe(0);
  });
});

describe("useOnboardingState", () => {
  const rpcPatches = () =>
    supabaseFake.rpcCalls
      .filter((c) => c.fn === "set_onboarding_state")
      .map((c) => (c.args as { patch: unknown }).patch);

  it("estado inválido no profile vira estado vazio", () => {
    h.profile = { onboarding_state: "lixo" };
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.state).toEqual({ dismissed: false, completed_at: null, tours_seen: [] });
  });

  it("dismiss e reset persistem e recarregam o profile", async () => {
    const { result } = renderHook(() => useOnboardingState());
    await act(() => result.current.dismiss());
    await act(() => result.current.dismiss(false));
    await act(() => result.current.reset());
    expect(rpcPatches()).toEqual([
      { dismissed: true },
      { dismissed: false },
      { dismissed: false, completed_at: null, tours_seen: [] },
    ]);
    expect(h.refreshProfile).toHaveBeenCalledTimes(3);
  });

  it("markTourSeen acrescenta só tour novo", async () => {
    h.profile = { onboarding_state: { tours_seen: ["a"] } };
    const { result } = renderHook(() => useOnboardingState());
    await act(() => result.current.markTourSeen("a"));
    expect(rpcPatches()).toEqual([]);
    await act(() => result.current.markTourSeen("b"));
    expect(rpcPatches()).toEqual([{ tours_seen: ["a", "b"] }]);
  });

  it("setCompleted só grava uma vez", async () => {
    h.profile = { onboarding_state: { completed_at: "2026-01-01T00:00:00Z" } };
    const ja = renderHook(() => useOnboardingState());
    await act(() => ja.result.current.setCompleted());
    expect(rpcPatches()).toEqual([]);

    h.profile = { onboarding_state: {} };
    const novo = renderHook(() => useOnboardingState());
    await act(() => novo.result.current.setCompleted());
    expect(rpcPatches()[0]).toHaveProperty("completed_at");
  });

  it("erro da RPC é propagado sem recarregar o profile", async () => {
    supabaseFake.respondRpc("set_onboarding_state", { error: { message: "not authenticated" } });
    const { result } = renderHook(() => useOnboardingState());
    await expect(result.current.dismiss()).rejects.toThrow("not authenticated");
    expect(h.refreshProfile).not.toHaveBeenCalled();
  });
});
