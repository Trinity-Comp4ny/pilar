import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// BEZ-460: o RPC de retomar empurra o prazo no banco. O hook devolve o estado lido depois dele
// para a tela mostrar, em vez de regravar a disciplina com o snapshot de antes da retomada.
// BEZ-462: pausar e retomar também refrescam o Histórico do projeto.

const mockRpc = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      update: mockUpdate,
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }), single: mockSingle }),
      }),
    }),
  },
}));

import { useDisciplinaPausas } from "./useDisciplinaPausas";

const estadoRetomado = { status: "Em Andamento", data_inicio: "2026-10-27", data_fim: "2026-11-08" };

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { invalidar, ...renderHook(() => useDisciplinaPausas("disc-1"), { wrapper }) };
}

describe("useDisciplinaPausas", () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ error: null });
    mockSingle.mockReset().mockResolvedValue({ data: estadoRetomado, error: null });
    mockUpdate.mockReset();
  });

  it("retomar devolve o estado que o RPC deixou no banco, com o prazo já empurrado", async () => {
    const { result } = montar();
    let estado: unknown;
    await act(async () => {
      estado = await result.current.retomar.mutateAsync();
    });

    expect(mockRpc).toHaveBeenCalledWith("rpc_retomar_disciplina", { p_disciplina_id: "disc-1" });
    expect(estado).toEqual(estadoRetomado);
  });

  it("não regrava a disciplina: quem empurra o prazo é só o RPC", async () => {
    const { result } = montar();
    await act(async () => {
      await result.current.retomar.mutateAsync();
      await result.current.pausar.mutateAsync("cliente pediu");
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("pausar devolve o estado depois do RPC", async () => {
    mockSingle.mockResolvedValue({ data: { ...estadoRetomado, status: "Pausada" }, error: null });
    const { result } = montar();
    let estado: unknown;
    await act(async () => {
      estado = await result.current.pausar.mutateAsync("obra parada");
    });

    expect(mockRpc).toHaveBeenCalledWith("rpc_pausar_disciplina", {
      p_disciplina_id: "disc-1",
      p_motivo: "obra parada",
    });
    expect(estado).toMatchObject({ status: "Pausada" });
  });

  it("pausar e retomar refrescam o Histórico do projeto", async () => {
    const { result, invalidar } = montar();
    await act(async () => {
      await result.current.retomar.mutateAsync();
    });

    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["projeto-timeline"] }));
  });

  it("erro do RPC não lê estado nem avança", async () => {
    mockRpc.mockResolvedValue({ error: new Error("Não há pausa em aberto pra essa disciplina") });
    const { result } = montar();
    await act(async () => {
      await expect(result.current.retomar.mutateAsync()).rejects.toThrow("Não há pausa");
    });

    expect(mockSingle).not.toHaveBeenCalled();
  });
});
