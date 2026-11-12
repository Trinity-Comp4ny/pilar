import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

// Hooks do Google Agenda (SPEC 164): status da conexão, reuniões e agendas da conta.

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  rpc: vi.fn(),
  calls: [] as ChainQuery[],
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc } };
});

import { useAgendasDaConta, useEventosAgenda, useStatusAgenda } from "./useGoogleAgenda";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.resolve.mockReturnValue({ data: [] });
});

describe("useStatusAgenda", () => {
  it("conectado: conta, datas e o aviso padrão", async () => {
    h.rpc.mockResolvedValue({
      data: [
        {
          conectado: true,
          google_email: "ana@vrz.com",
          conectado_em: "2026-11-12T10:00:00Z",
          sincronizado_em: "2026-11-12T10:05:00Z",
          erro: null,
          lembrete_minutos: 30,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useStatusAgenda(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(h.rpc).toHaveBeenCalledWith("get_google_agenda_status");
    expect(result.current.data).toEqual({
      conectado: true,
      email: "ana@vrz.com",
      conectadoEm: "2026-11-12T10:00:00Z",
      sincronizadoEm: "2026-11-12T10:05:00Z",
      reconectar: false,
      lembreteMinutos: 30,
    });
  });

  it("acesso revogado pede reconectar; aviso negativo é 'não avisar'", async () => {
    h.rpc.mockResolvedValue({
      data: [{ conectado: true, google_email: "a@b.com", erro: "reconectar", lembrete_minutos: -1 }],
      error: null,
    });
    const { result } = renderHook(() => useStatusAgenda(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.reconectar).toBe(true);
    expect(result.current.data?.lembreteMinutos).toBeNull();
  });

  it("sem conexão: desconectado e aviso de 10 minutos de partida", async () => {
    h.rpc.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useStatusAgenda(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ conectado: false, email: null, lembreteMinutos: 10 });
  });

  it("erro do banco vira erro da consulta", async () => {
    h.rpc.mockResolvedValue({ data: null, error: new Error("negado") });
    const { result } = renderHook(() => useStatusAgenda(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useEventosAgenda", () => {
  it("só busca quando conectado, em ordem de início", async () => {
    const { result, rerender } = renderHook(({ ligado }) => useEventosAgenda(ligado), {
      wrapper,
      initialProps: { ligado: false },
    });
    expect(h.calls).toHaveLength(0);
    h.resolve.mockReturnValue({ data: [{ id: "r1", titulo: "Reunião" }] });
    rerender({ ligado: true });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "r1", titulo: "Reunião" }]));
    const q = h.calls[0];
    expect(q.table).toBe("agenda_eventos_google");
    expect(q.columns).toContain("calendario_id");
    expect(q.filters).toContainEqual(["order", "inicio", { ascending: true }]);
  });

  it("erro do banco vira erro da consulta", async () => {
    h.resolve.mockReturnValue({ data: null, error: new Error("x") });
    const { result } = renderHook(() => useEventosAgenda(true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAgendasDaConta", () => {
  it("lista as agendas com a principal primeiro", async () => {
    h.resolve.mockReturnValue({ data: [{ id: "c1", nome: "Pessoal", principal: true }] });
    const { result } = renderHook(() => useAgendasDaConta(true), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(h.calls[0].table).toBe("google_agenda_calendarios");
    expect(h.calls[0].filters[0]).toEqual(["order", "principal", { ascending: false }]);
  });

  it("desligado não consulta; erro vira erro", async () => {
    renderHook(() => useAgendasDaConta(false), { wrapper });
    expect(h.calls).toHaveLength(0);
    h.resolve.mockReturnValue({ data: null, error: new Error("x") });
    const { result } = renderHook(() => useAgendasDaConta(true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
