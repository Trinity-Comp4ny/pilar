import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake } from "@/pages/obras/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));

import { useResumoCustoObras } from "./useResumoCustoObras";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const no = (id: string, obra_id: string, parent_id: string | null = null) => ({
  id,
  obra_id,
  parent_id,
  nivel: parent_id ? "etapa" : "fase",
  nome: id,
  ordem: 0,
  created_at: "2026-01-01T00:00:00Z",
});

describe("useResumoCustoObras", () => {
  beforeEach(() => fake.reset());

  it("soma previsto e realizado por obra, sem misturar obras", async () => {
    fake.responder((c) => {
      if (c.tabela === "obra_frente") return { data: [no("f1", "A"), no("e1", "A", "f1"), no("f2", "B")], error: null };
      if (c.tabela === "obra_orcamento_etapa")
        return {
          data: [
            { obra_id: "A", obra_frente_id: "f1", valor_previsto: 1000 },
            { obra_id: "B", obra_frente_id: "f2", valor_previsto: 500 },
          ],
          error: null,
        };
      if (c.tabela === "obra_conta_lancamento")
        return {
          data: [
            { obra_id: "A", tipo: "despesa", valor: 300, obra_frente_id: "e1" },
            { obra_id: "A", tipo: "despesa", valor: 100, obra_frente_id: null },
            { obra_id: "B", tipo: "despesa", valor: 50, obra_frente_id: "f2" },
          ],
          error: null,
        };
      return undefined;
    });
    const { result } = renderHook(() => useResumoCustoObras(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.get("A")).toEqual({ previsto: 1000, realizado: 400 });
    expect(result.current.data?.get("B")).toEqual({ previsto: 500, realizado: 50 });
  });

  it("obra com despesa e sem etapas ainda entra, com previsto zero", async () => {
    fake.responder((c) =>
      c.tabela === "obra_conta_lancamento"
        ? { data: [{ obra_id: "C", tipo: "despesa", valor: 70, obra_frente_id: null }], error: null }
        : { data: [], error: null }
    );
    const { result } = renderHook(() => useResumoCustoObras(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.get("C")).toEqual({ previsto: 0, realizado: 70 });
  });

  it("erro de uma das consultas vira erro do hook", async () => {
    fake.responder((c) =>
      c.tabela === "obra_frente" ? { data: null, error: new Error("RLS") } : { data: [], error: null }
    );
    const { result } = renderHook(() => useResumoCustoObras(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
