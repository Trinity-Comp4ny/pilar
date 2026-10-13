import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

import { usePagarFatura } from "./usePagarFatura";

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function chaveDaChamada(n: number): string {
  return (rpc.mock.calls[n][1] as { p_idempotency_key: string }).p_idempotency_key;
}

const input = { faturaId: "fat-1", contaId: "conta-1", valor: 1234.56, dataPagamento: new Date(2026, 9, 13) };

describe("usePagarFatura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  it("chama pagar_fatura com valor, data no formato do banco e chave de idempotência", async () => {
    rpc.mockResolvedValue({ error: null });
    const { result } = renderHook(() => usePagarFatura(), { wrapper });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith("pagar_fatura", {
      p_fatura_id: "fat-1",
      p_conta_id: "conta-1",
      p_valor_pago: 1234.56,
      p_data_pagamento: "2026-10-13",
      p_idempotency_key: expect.any(String),
    });
  });

  it("retentativa depois de erro reaproveita a mesma chave (o banco não duplica o pagamento)", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "network" } }).mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => usePagarFatura(), { wrapper });

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
  });

  it("pagamento novo depois de um sucesso usa chave nova", async () => {
    rpc.mockResolvedValue({ error: null });
    const { result } = renderHook(() => usePagarFatura(), { wrapper });

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    result.current.mutate({ ...input, faturaId: "fat-2" });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));

    expect(chaveDaChamada(1)).not.toBe(chaveDaChamada(0));
  });

  it("sucesso atualiza faturas, cartões, saldo das contas e lançamentos", async () => {
    rpc.mockResolvedValue({ error: null });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePagarFatura(), { wrapper });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const chaves = invalidate.mock.calls.map(([f]) => (f as { queryKey: string[] }).queryKey[0]);
    expect(chaves).toEqual(["faturas", "cartoes-resumo", "contas-resumo", "lancamentos-paginados"]);
  });
});
