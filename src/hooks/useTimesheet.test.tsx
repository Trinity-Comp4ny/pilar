import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import {
  useTimesheetLancamentos,
  useLancarHoras,
  useAprovarHoras,
  useAprovarHorasLote,
  useRejeitarHoras,
  useReabrirHoras,
} from "./useTimesheet";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const ERRO = { message: "new row violates row-level security policy", code: "42501" };
const T = "timesheet_lancamentos";

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("useTimesheetLancamentos", () => {
  it("mapeia joins com fallbacks e converte horas", async () => {
    supabaseFake.respond(T, "select", {
      data: [
        {
          id: "l1",
          horas: "2.5",
          status: "pendente",
          projetos: { nome: "Torre" },
          projeto_orcamento_fases: { disciplina: "Civil" },
          profiles: { nome: "Ana", sobrenome: "Lima" },
        },
        { id: "l2", horas: 1, projetos: null, projeto_orcamento_fases: null, profiles: { nome: "Bia" } },
        { id: "l3", horas: 0, profiles: null },
      ],
    });
    const { result } = renderHook(() => useTimesheetLancamentos(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [a, b, c] = result.current.data!;
    expect(a).toMatchObject({ horas: 2.5, projeto_nome: "Torre", fase_nome: "Civil", user_nome: "Ana Lima" });
    expect(b).toMatchObject({ projeto_nome: "—", fase_nome: null, user_nome: "Bia", fase_id: null });
    expect(c).toMatchObject({ user_nome: "—", aprovado_por: null });
    expect(supabaseFake.calls[0].chain.filter(([m]) => ["eq", "gte", "lte"].includes(m))).toEqual([]);
  });

  it("aplica todos os filtros", async () => {
    const { result } = renderHook(
      () =>
        useTimesheetLancamentos({
          projetoId: "p1",
          userId: "u2",
          status: "aprovado",
          dataInicio: "2026-01-01",
          dataFim: "2026-01-31",
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    const chain = supabaseFake.calls[0].chain;
    expect(chain).toContainEqual(["eq", ["projeto_id", "p1"]]);
    expect(chain).toContainEqual(["eq", ["user_id", "u2"]]);
    expect(chain).toContainEqual(["eq", ["status", "aprovado"]]);
    expect(chain).toContainEqual(["gte", ["data", "2026-01-01"]]);
    expect(chain).toContainEqual(["lte", ["data", "2026-01-31"]]);
  });

  it("propaga erro", async () => {
    supabaseFake.respond(T, "select", { error: ERRO });
    const { result } = renderHook(() => useTimesheetLancamentos(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useLancarHoras", () => {
  it("insere com empresa e usuário e avisa", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLancarHoras(), { wrapper });
    await act(() => result.current.mutateAsync({ projeto_id: "p1", descricao: "d", horas: 2, data: "2026-01-02" }));
    expect(supabaseFake.callsTo(T, "insert")[0].payload).toEqual({
      empresa_id: "emp-1",
      user_id: "u1",
      projeto_id: "p1",
      fase_id: null,
      descricao: "d",
      horas: 2,
      data: "2026-01-02",
    });
    expect(toast.success).toHaveBeenCalledWith("Horas lançadas com sucesso");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["timesheet-lancamentos"] });
  });

  it("RLS recusa (ex.: sem empresa): toast de erro com a mensagem", async () => {
    supabaseFake.respond(T, "insert", { error: ERRO });
    const { result } = renderHook(() => useLancarHoras(), { wrapper });
    await expect(
      result.current.mutateAsync({ projeto_id: "p1", fase_id: "f1", descricao: "d", horas: 1, data: "2026-01-02" })
    ).rejects.toEqual(ERRO);
    expect(toast.error).toHaveBeenCalledWith("Erro ao lançar horas", { description: ERRO.message });
  });
});

describe("aprovação", () => {
  it.each([
    ["useAprovarHoras", () => useAprovarHoras(), { status: "aprovado", aprovado_por: "u1" }, "Lançamento aprovado"],
    ["useRejeitarHoras", () => useRejeitarHoras(), { status: "rejeitado", aprovado_por: "u1" }, "Lançamento rejeitado"],
    ["useReabrirHoras", () => useReabrirHoras(), { status: "pendente", aprovado_por: null }, "Lançamento reaberto"],
  ] as const)("%s grava o status por id", async (_n, hook, payload, msg) => {
    const { result } = renderHook(hook, { wrapper });
    await act(() => result.current.mutateAsync("l1"));
    const call = supabaseFake.callsTo(T, "update")[0];
    expect(call.payload).toEqual(payload);
    expect(call.chain).toContainEqual(["eq", ["id", "l1"]]);
    expect(toast.success).toHaveBeenCalledWith(msg);
  });

  it.each([
    ["useAprovarHoras", () => useAprovarHoras(), "Erro ao aprovar"],
    ["useRejeitarHoras", () => useRejeitarHoras(), "Erro ao rejeitar"],
    ["useReabrirHoras", () => useReabrirHoras(), "Erro ao reabrir"],
  ] as const)("%s em erro avisa", async (_n, hook, msg) => {
    supabaseFake.respond(T, "update", { error: ERRO });
    const { result } = renderHook(hook, { wrapper });
    await expect(result.current.mutateAsync("l1")).rejects.toEqual(ERRO);
    expect(toast.error).toHaveBeenCalledWith(msg, { description: ERRO.message });
  });

  it("lote aprova os ids informados", async () => {
    const { result } = renderHook(() => useAprovarHorasLote(), { wrapper });
    await act(() => result.current.mutateAsync(["a", "b"]));
    expect(supabaseFake.callsTo(T, "update")[0].chain).toContainEqual(["in", ["id", ["a", "b"]]]);
    expect(toast.success).toHaveBeenCalledWith("2 lançamento(s) aprovado(s)");
  });

  it("lote vazio não consulta o banco", async () => {
    const { result } = renderHook(() => useAprovarHorasLote(), { wrapper });
    await act(() => result.current.mutateAsync([]));
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("lote em erro avisa", async () => {
    supabaseFake.respond(T, "update", { error: ERRO });
    const { result } = renderHook(() => useAprovarHorasLote(), { wrapper });
    await expect(result.current.mutateAsync(["a"])).rejects.toEqual(ERRO);
    expect(toast.error).toHaveBeenCalledWith("Erro ao aprovar", { description: ERRO.message });
  });
});
