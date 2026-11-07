import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

import {
  usePropostas,
  useCreateProposta,
  useUpdateProposta,
  useDeleteProposta,
  useRestoreProposta,
  useConverterProposta,
  usePropostaDisciplinas,
  useSalvarPropostaDisciplinas,
} from "./usePropostas";

type MutacaoGenerica = { mutateAsync: (a: unknown) => Promise<unknown> };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
});

describe("usePropostas", () => {
  it("lista só as não excluídas e achata nome de cliente e lead", async () => {
    supabaseFake.respond("propostas", "select", {
      data: [{ id: "p1", titulo: "A", clientes: { nome: "Alfa" }, leads: null }],
    });
    const { result } = renderHook(() => usePropostas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ cliente_nome: "Alfa", lead_nome: null });
    expect(supabaseFake.callsTo("propostas")[0].chain).toContainEqual(["is", ["deleted_at", null]]);
  });

  it("erro na listagem vira estado de erro", async () => {
    supabaseFake.respond("propostas", "select", { error: { message: "boom" } });
    const { result } = renderHook(() => usePropostas(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("mutations de proposta", () => {
  it("criar grava na empresa do usuário", async () => {
    supabaseFake.respond("propostas", "insert", { data: { id: "p9" } });
    const { result } = renderHook(() => useCreateProposta(), { wrapper });
    await expect(result.current.mutateAsync({ titulo: "Clínica", valor_proposto: 1000 })).resolves.toEqual({
      id: "p9",
    });
    expect(supabaseFake.callsTo("propostas", "insert")[0].payload).toEqual({
      titulo: "Clínica",
      valor_proposto: 1000,
      empresa_id: "emp-1",
    });
  });

  it("criar sem empresa não grava", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: null });
    const { result } = renderHook(() => useCreateProposta(), { wrapper });
    await expect(result.current.mutateAsync({ titulo: "X" })).rejects.toThrow("Usuário não vinculado a uma empresa");
    expect(supabaseFake.callsTo("propostas")).toHaveLength(0);
  });

  it("código duplicado no banco é propagado", async () => {
    supabaseFake.respond("propostas", "insert", { error: { code: "23505", message: "duplicate key value" } });
    const { result } = renderHook(() => useCreateProposta(), { wrapper });
    await expect(result.current.mutateAsync({ titulo: "X", codigo: "PROP-001" })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("atualizar manda só os campos, filtrando pelo id", async () => {
    supabaseFake.respond("propostas", "update", { data: { id: "p1" } });
    const { result } = renderHook(() => useUpdateProposta(), { wrapper });
    await result.current.mutateAsync({ id: "p1", status: "aceita" });
    const [upd] = supabaseFake.callsTo("propostas", "update");
    expect(upd.payload).toEqual({ status: "aceita" });
    expect(upd.chain).toContainEqual(["eq", ["id", "p1"]]);
  });

  it("excluir é soft delete e restaurar limpa deleted_at", async () => {
    const del = renderHook(() => useDeleteProposta(), { wrapper });
    await del.result.current.mutateAsync("p1");
    expect(typeof (supabaseFake.callsTo("propostas", "update")[0].payload as { deleted_at: string }).deleted_at).toBe(
      "string"
    );
    const res = renderHook(() => useRestoreProposta(), { wrapper });
    await res.result.current.mutateAsync("p1");
    expect(supabaseFake.callsTo("propostas", "update")[1].payload).toEqual({ deleted_at: null });
  });

  it("excluir com erro rejeita", async () => {
    supabaseFake.respond("propostas", "update", { error: { message: "x" } });
    const { result } = renderHook(() => useDeleteProposta(), { wrapper });
    await expect(result.current.mutateAsync("p1")).rejects.toBeTruthy();
  });

  it("converter chama o RPC e devolve o id do projeto", async () => {
    supabaseFake.respondRpc("rpc_converter_proposta_projeto", { data: "proj-1" });
    const { result } = renderHook(() => useConverterProposta(), { wrapper });
    await expect(result.current.mutateAsync("p1")).resolves.toBe("proj-1");
    expect(supabaseFake.rpcCalls).toContainEqual({
      fn: "rpc_converter_proposta_projeto",
      args: { p_proposta_id: "p1" },
    });
  });

  it("converter com limite de projetos preserva a mensagem e o hint do banco", async () => {
    supabaseFake.respondRpc("rpc_converter_proposta_projeto", {
      error: { message: "capacidade:projetos", hint: "3" },
    });
    const { result } = renderHook(() => useConverterProposta(), { wrapper });
    await expect(result.current.mutateAsync("p1")).rejects.toMatchObject({ message: "capacidade:projetos", hint: "3" });
  });

  it("salvar disciplinas usa o RPC transacional", async () => {
    const { result } = renderHook(() => useSalvarPropostaDisciplinas(), { wrapper });
    const disciplinas = [{ disciplina: "Estrutural", horas_estimadas: 10, custo_hora: 100, valor_venda: 2000 }];
    await result.current.mutateAsync({ propostaId: "p1", disciplinas });
    expect(supabaseFake.rpcCalls).toContainEqual({
      fn: "rpc_salvar_proposta_disciplinas",
      args: { p_proposta_id: "p1", p_disciplinas: disciplinas },
    });
  });

  it("disciplinas de proposta nula não consultam", () => {
    renderHook(() => usePropostaDisciplinas(null), { wrapper });
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("disciplinas da proposta: lista filtrada; nula vira vazia; erro propaga", async () => {
    supabaseFake.respond(
      "proposta_disciplinas",
      "select",
      { data: [{ id: "d1", disciplina: "Civil" }] },
      { data: null },
      { error: { message: "permission denied" } }
    );
    const a = renderHook(() => usePropostaDisciplinas("p1"), { wrapper });
    await waitFor(() => expect(a.result.current.data).toEqual([{ id: "d1", disciplina: "Civil" }]));
    expect(supabaseFake.callsTo("proposta_disciplinas")[0].chain).toContainEqual(["eq", ["proposta_id", "p1"]]);

    const b = renderHook(() => usePropostaDisciplinas("p2"), { wrapper });
    await waitFor(() => expect(b.result.current.data).toEqual([]));

    const c = renderHook(() => usePropostaDisciplinas("p3"), { wrapper });
    await waitFor(() => expect(c.result.current.isError).toBe(true));
  });

  it("listagem com cliente e lead preenchidos e data nula", async () => {
    supabaseFake.respond(
      "propostas",
      "select",
      { data: [{ id: "p1", clientes: null, leads: { nome: "Lead A" } }] },
      { data: null }
    );
    const { result } = renderHook(() => usePropostas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ cliente_nome: null, lead_nome: "Lead A" });
    await result.current.refetch();
    await waitFor(() => expect(result.current.data).toEqual([]));
  });

  it.each([
    ["atualizar", () => useUpdateProposta(), { id: "p1", status: "x" }],
    ["restaurar", () => useRestoreProposta(), "p1"],
  ] as const)("%s com erro rejeita", async (_n, hook, arg) => {
    supabaseFake.respond("propostas", "update", { error: { message: "permission denied" } });
    const { result } = renderHook(() => hook() as unknown as MutacaoGenerica, { wrapper });
    await expect(result.current.mutateAsync(arg)).rejects.toMatchObject({
      message: "permission denied",
    });
  });

  it("salvar disciplinas com erro do RPC rejeita", async () => {
    supabaseFake.respondRpc("rpc_salvar_proposta_disciplinas", { error: { message: "rpc" } });
    const { result } = renderHook(() => useSalvarPropostaDisciplinas(), { wrapper });
    await expect(result.current.mutateAsync({ propostaId: "p1", disciplinas: [] })).rejects.toMatchObject({
      message: "rpc",
    });
  });
});
