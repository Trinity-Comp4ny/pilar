import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => ({ update })) },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import { useUpdateLead } from "./useLeads";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useUpdateLead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("avisa erro quando o update não grava nenhuma linha (RLS filtrou)", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useUpdateLead(), { wrapper });

    result.current.mutate({ id: "lead-1", data: { notas: "nova nota" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Erro ao atualizar",
      expect.objectContaining({ description: expect.stringContaining("não foi salvo") })
    );
  });

  it("envia null para limpar campo e confirma sucesso quando a linha volta", async () => {
    select.mockResolvedValue({ data: [{ id: "lead-1" }], error: null });
    const { result } = renderHook(() => useUpdateLead(), { wrapper });

    result.current.mutate({ id: "lead-1", data: { notas: null, email: "  " } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(update).toHaveBeenCalledWith({ notas: null, email: null });
    expect(eq).toHaveBeenCalledWith("id", "lead-1");
    expect(toastSuccess).toHaveBeenCalledWith("Lead atualizado");
  });
});
