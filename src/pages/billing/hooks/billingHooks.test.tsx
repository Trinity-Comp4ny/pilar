import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Assinatura da plataforma: leitura da assinatura com o plano embutido (features
// normalizadas) e a mutação de troca de plano/cancelamento via edge function.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import { useMySubscription } from "./useMySubscription";
import { useSubscriptionManage } from "./useSubscriptionManage";

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("useMySubscription", () => {
  it("devolve a assinatura com o plano; features fora de lista viram lista vazia", async () => {
    sb.resultado("pilar_subscriptions.select", {
      data: { id: "s1", status: "active", plan: { slug: "pro", features: "nao-lista" } },
      error: null,
    });
    const { result } = renderHook(() => useMySubscription(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "s1", status: "active", plan: { slug: "pro", features: [] } });
  });

  it("mantém as features quando já são lista e aceita assinatura sem plano", async () => {
    sb.resultado("pilar_subscriptions.select", [
      { data: { id: "s1", plan: { slug: "pro", features: ["a", "b"] } }, error: null },
    ]);
    const { result } = renderHook(() => useMySubscription(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.plan?.features).toEqual(["a", "b"]);

    sb.resultado("pilar_subscriptions.select", { data: { id: "s2", plan: null }, error: null });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const sem = renderHook(() => useMySubscription(), { wrapper });
    await waitFor(() => expect(sem.result.current.isSuccess).toBe(true));
    expect(sem.result.current.data).toEqual({ id: "s2", plan: null });
  });

  it("sem assinatura devolve null", async () => {
    sb.resultado("pilar_subscriptions.select", { data: null, error: null });
    const { result } = renderHook(() => useMySubscription(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("erro do banco vira erro da query com a mensagem", async () => {
    sb.resultado("pilar_subscriptions.select", { data: null, error: { message: "rls" } });
    const { result } = renderHook(() => useMySubscription(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("rls");
  });
});

describe("useSubscriptionManage", () => {
  const invoke = () => vi.mocked(sb.client.functions.invoke);

  it("troca de plano chama a edge e invalida a assinatura", async () => {
    invoke().mockResolvedValueOnce({ data: { success: true, refunded: false }, error: null } as never);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSubscriptionManage(), { wrapper });
    let r;
    await act(async () => {
      r = await result.current.mutateAsync({ action: "update_plan", new_plan_slug: "pro", new_cycle: "yearly" });
    });
    expect(r).toEqual({ success: true, refunded: false });
    expect(invoke()).toHaveBeenCalledWith("pilar-subscription-manage", {
      body: { action: "update_plan", new_plan_slug: "pro", new_cycle: "yearly" },
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["pilar-my-subscription"] });
  });

  it("erro de transporte usa a mensagem do erro (ou o padrão)", async () => {
    invoke()
      .mockResolvedValueOnce({ data: null, error: { message: "timeout" } } as never)
      .mockResolvedValueOnce({ data: null, error: {} } as never);
    const { result } = renderHook(() => useSubscriptionManage(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ action: "cancel" })).rejects.toThrow("timeout");
    });
    await act(async () => {
      await expect(result.current.mutateAsync({ action: "cancel" })).rejects.toThrow("Erro ao gerenciar assinatura");
    });
  });

  it("resposta sem sucesso usa o erro devolvido (ou 'Falha desconhecida')", async () => {
    invoke()
      .mockResolvedValueOnce({ data: { success: false, error: "Plano inválido" }, error: null } as never)
      .mockResolvedValueOnce({ data: null, error: null } as never);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSubscriptionManage(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ action: "cancel" })).rejects.toThrow("Plano inválido");
    });
    await act(async () => {
      await expect(result.current.mutateAsync({ action: "cancel" })).rejects.toThrow("Falha desconhecida");
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
