import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

import { usePlans, calculateYearlySavingPct, type Plan } from "./usePlans";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("usePlans", () => {
  it("só ativos, por ordem; features não-array vira []", async () => {
    supabaseFake.respond("pilar_subscription_plans", "select", {
      data: [
        { id: "a", features: ["x"] },
        { id: "b", features: null },
      ],
    });
    const { result } = renderHook(() => usePlans(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: "a", features: ["x"] },
      { id: "b", features: [] },
    ]);
    const chain = supabaseFake.calls[0].chain;
    expect(chain).toContainEqual(["eq", ["ativo", true]]);
    expect(chain).toContainEqual(["order", ["ordem", { ascending: true }]]);
  });

  it("sem dados: lista vazia", async () => {
    supabaseFake.respond("pilar_subscription_plans", "select", { data: null });
    const { result } = renderHook(() => usePlans(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("erro vira Error com a mensagem do banco", async () => {
    supabaseFake.respond("pilar_subscription_plans", "select", { error: { message: "relation does not exist" } });
    const { result } = renderHook(() => usePlans(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("relation does not exist");
  });
});

describe("calculateYearlySavingPct: bordas", () => {
  const plano = (preco_mensal: number, preco_anual: number | null) => ({ preco_mensal, preco_anual }) as Plan;

  it("sem preço anual, mensal zero ou anual sem desconto: null", () => {
    expect(calculateYearlySavingPct(plano(299, null))).toBeNull();
    expect(calculateYearlySavingPct(plano(0, 100))).toBeNull();
    expect(calculateYearlySavingPct(plano(100, 1200))).toBeNull();
  });

  it("anual com desconto: percentual arredondado", () => {
    expect(calculateYearlySavingPct(plano(299, 2990))).toBe(17);
  });
});
