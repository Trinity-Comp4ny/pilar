import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

import {
  useEscopos,
  usePendenciasAgentes,
  useOrcamentoFases,
  useSalvarOrcamentoFase,
  useAprovarEscopo,
  useRejeitarEscopo,
  useAdiarEscopo,
} from "./useEscopos";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const ERRO = { message: "permission denied for view escopos_safe", code: "42501" };

beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useEscopos", () => {
  it("sem projeto não consulta", () => {
    const { result } = renderHook(() => useEscopos(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("lê da view segura, filtrando projeto e excluídos", async () => {
    supabaseFake.respond("escopos_safe", "select", { data: [{ id: "e1" }] });
    const { result } = renderHook(() => useEscopos("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "e1" }]);
    expect(supabaseFake.calls[0].chain).toContainEqual(["eq", ["projeto_id", "p1"]]);
    expect(supabaseFake.calls[0].chain).toContainEqual(["is", ["deleted_at", null]]);
  });

  it("data nula vira lista vazia", async () => {
    supabaseFake.respond("escopos_safe", "select", { data: null });
    const { result } = renderHook(() => useEscopos("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga erro", async () => {
    supabaseFake.respond("escopos_safe", "select", { error: ERRO });
    const { result } = renderHook(() => useEscopos("p1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("usePendenciasAgentes", () => {
  it("separa o nome do projeto com fallback", async () => {
    supabaseFake.respond("escopos_safe", "select", {
      data: [
        { id: "a1", projeto_nome: "Torre A" },
        { id: "a2", projeto_nome: null },
      ],
    });
    const { result } = renderHook(() => usePendenciasAgentes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: "a1", projeto_nome: "Torre A" },
      { id: "a2", projeto_nome: "Projeto" },
    ]);
    const chain = supabaseFake.calls[0].chain;
    expect(chain).toContainEqual(["eq", ["tipo", "aditivo"]]);
    expect(chain).toContainEqual(["in", ["status", ["rascunho", "pendente_aprovacao"]]]);
    expect(chain.find(([m]) => m === "or")?.[1][0]).toMatch(/^adiado_ate\.is\.null,adiado_ate\.lte\./);
  });

  it("sem dados: lista vazia", async () => {
    supabaseFake.respond("escopos_safe", "select", { data: null });
    const { result } = renderHook(() => usePendenciasAgentes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga erro", async () => {
    supabaseFake.respond("escopos_safe", "select", { error: ERRO });
    const { result } = renderHook(() => usePendenciasAgentes(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useOrcamentoFases", () => {
  it("sem projeto não consulta", () => {
    const { result } = renderHook(() => useOrcamentoFases(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("lista as fases do projeto", async () => {
    supabaseFake.respond("projeto_orcamento_fases", "select", { data: [{ disciplina: "Civil" }] });
    const { result } = renderHook(() => useOrcamentoFases("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ disciplina: "Civil" }]);
  });

  it("data nula vira lista vazia", async () => {
    supabaseFake.respond("projeto_orcamento_fases", "select", { data: null });
    const { result } = renderHook(() => useOrcamentoFases("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga erro", async () => {
    supabaseFake.respond("projeto_orcamento_fases", "select", { error: ERRO });
    const { result } = renderHook(() => useOrcamentoFases("p1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useSalvarOrcamentoFase", () => {
  it("upsert por projeto+disciplina com a empresa do usuário", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSalvarOrcamentoFase("p1"), { wrapper });
    await act(() => result.current.mutateAsync({ disciplina: "Civil", horasEstimadas: 10, custoHora: 100 }));
    const call = supabaseFake.callsTo("projeto_orcamento_fases", "upsert")[0];
    expect(call.payload).toEqual({
      empresa_id: "emp-1",
      projeto_id: "p1",
      disciplina: "Civil",
      horas_estimadas: 10,
      custo_hora: 100,
    });
    expect(call.chain[0][1][1]).toEqual({ onConflict: "projeto_id,disciplina" });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["projeto_orcamento_fases", "p1"] });
  });

  it("erro ao resolver a empresa", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { error: { message: "rpc" } });
    const { result } = renderHook(() => useSalvarOrcamentoFase("p1"), { wrapper });
    await expect(result.current.mutateAsync({ disciplina: "C", horasEstimadas: 1, custoHora: 1 })).rejects.toEqual({
      message: "rpc",
    });
    expect(supabaseFake.callsTo("projeto_orcamento_fases")).toHaveLength(0);
  });

  it("usuário sem empresa não grava", async () => {
    const { result } = renderHook(() => useSalvarOrcamentoFase("p1"), { wrapper });
    await expect(result.current.mutateAsync({ disciplina: "C", horasEstimadas: 1, custoHora: 1 })).rejects.toThrow(
      "Usuário não vinculado a uma empresa"
    );
    expect(supabaseFake.callsTo("projeto_orcamento_fases")).toHaveLength(0);
  });

  it("erro no upsert", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
    supabaseFake.respond("projeto_orcamento_fases", "upsert", { error: ERRO });
    const { result } = renderHook(() => useSalvarOrcamentoFase("p1"), { wrapper });
    await expect(result.current.mutateAsync({ disciplina: "C", horasEstimadas: 1, custoHora: 1 })).rejects.toEqual(
      ERRO
    );
  });
});

describe("useAprovarEscopo", () => {
  it("grava aprovador e invalida contrato, quadro e pendências", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAprovarEscopo(), { wrapper });
    await act(() => result.current.mutateAsync({ escopoId: "e1", projetoId: "p1" }));
    const call = supabaseFake.callsTo("escopos", "update")[0];
    expect(call.payload).toMatchObject({ status: "aprovado", aprovado_por: "user-1" });
    expect(call.chain).toContainEqual(["eq", ["id", "e1"]]);
    for (const queryKey of [
      ["escopos", "p1"],
      ["projeto_orcamento_fases", "p1"],
      ["projeto-detail", "p1"],
      ["projetos"],
      ["escopos", "pendencias"],
    ]) {
      expect(spy).toHaveBeenCalledWith({ queryKey });
    }
  });

  it("sem usuário na sessão grava aprovador nulo", async () => {
    supabaseFake.setUser(null);
    const { result } = renderHook(() => useAprovarEscopo(), { wrapper });
    await act(() => result.current.mutateAsync({ escopoId: "e1", projetoId: "p1" }));
    expect(supabaseFake.callsTo("escopos", "update")[0].payload).toMatchObject({ aprovado_por: null });
  });

  it("propaga erro sem invalidar", async () => {
    supabaseFake.respond("escopos", "update", { error: ERRO });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAprovarEscopo(), { wrapper });
    await expect(result.current.mutateAsync({ escopoId: "e1", projetoId: "p1" })).rejects.toEqual(ERRO);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useRejeitarEscopo", () => {
  it("marca rejeitado", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRejeitarEscopo(), { wrapper });
    await act(() => result.current.mutateAsync({ escopoId: "e1", projetoId: "p1" }));
    expect(supabaseFake.callsTo("escopos", "update")[0].payload).toEqual({ status: "rejeitado" });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["escopos", "pendencias"] });
  });

  it("propaga erro", async () => {
    supabaseFake.respond("escopos", "update", { error: ERRO });
    const { result } = renderHook(() => useRejeitarEscopo(), { wrapper });
    await expect(result.current.mutateAsync({ escopoId: "e1", projetoId: "p1" })).rejects.toEqual(ERRO);
  });
});

describe("useAdiarEscopo", () => {
  it("adia N dias sem mudar status", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
    const { result } = renderHook(() => useAdiarEscopo(), { wrapper });
    await act(() => result.current.mutateAsync({ escopoId: "e1", dias: 3 }));
    expect(supabaseFake.callsTo("escopos", "update")[0].payload).toEqual({ adiado_ate: "2026-03-04T12:00:00.000Z" });
  });

  it("propaga erro", async () => {
    supabaseFake.respond("escopos", "update", { error: ERRO });
    const { result } = renderHook(() => useAdiarEscopo(), { wrapper });
    await expect(result.current.mutateAsync({ escopoId: "e1", dias: 1 })).rejects.toEqual(ERRO);
  });
});
