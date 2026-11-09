import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from "./useTemplates";
import { useFluxosDisciplinas, useCreateFluxo, useUpdateFluxo, useDeleteFluxo } from "./useFluxosDisciplinas";

type MutacaoGenerica = { mutateAsync: (a: unknown) => Promise<unknown> };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const ERRO = { message: "permission denied", code: "42501" };

beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("useTemplates", () => {
  it("só ativos e não excluídos; fases/checklist não-array viram []", async () => {
    supabaseFake.respond("templates_projeto", "select", {
      data: [
        { id: "t1", fases: [{ nome: "F1" }], checklist: [{ item: "i" }] },
        { id: "t2", fases: null, checklist: "x" },
      ],
    });
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: "t1", fases: [{ nome: "F1" }], checklist: [{ item: "i" }] },
      { id: "t2", fases: [], checklist: [] },
    ]);
    expect(supabaseFake.calls[0].chain).toContainEqual(["eq", ["ativo", true]]);
  });

  it("data nula vira lista vazia", async () => {
    supabaseFake.respond("templates_projeto", "select", { data: null });
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga erro", async () => {
    supabaseFake.respond("templates_projeto", "select", { error: ERRO });
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("cria com descrição/checklist opcionais normalizados", async () => {
    supabaseFake.respond("templates_projeto", "insert", { data: { id: "novo" } });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateTemplate(), { wrapper });
    let criado: unknown;
    await act(async () => {
      criado = await result.current.mutateAsync({ nome: "N", tipo_servico: "Outro", fases: [] });
    });
    expect(criado).toEqual({ id: "novo" });
    expect(supabaseFake.callsTo("templates_projeto", "insert")[0].payload).toEqual({
      nome: "N",
      tipo_servico: "Outro",
      descricao: null,
      fases: [],
      checklist: [],
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["templates-projeto"] });
  });

  it("atualiza pelo id", async () => {
    supabaseFake.respond("templates_projeto", "update", { data: { id: "t1" } });
    const { result } = renderHook(() => useUpdateTemplate(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        id: "t1",
        nome: "N",
        tipo_servico: "Outro",
        descricao: "d",
        fases: [],
        checklist: [{ item: "a", obrigatorio: true }],
      })
    );
    const call = supabaseFake.callsTo("templates_projeto", "update")[0];
    expect(call.payload).toMatchObject({ descricao: "d", checklist: [{ item: "a", obrigatorio: true }] });
    expect(call.chain).toContainEqual(["eq", ["id", "t1"]]);
  });

  it("exclui pelo id", async () => {
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });
    await act(() => result.current.mutateAsync("t1"));
    expect(supabaseFake.callsTo("templates_projeto", "delete")[0].chain).toContainEqual(["eq", ["id", "t1"]]);
  });

  it.each([
    ["insert", () => useCreateTemplate(), { nome: "N", tipo_servico: "x", fases: [] }],
    ["update", () => useUpdateTemplate(), { id: "t1", nome: "N", tipo_servico: "x", fases: [] }],
    ["delete", () => useDeleteTemplate(), "t1"],
  ] as const)("erro no %s é propagado", async (op, hook, arg) => {
    supabaseFake.respond("templates_projeto", op, { error: ERRO });
    const { result } = renderHook(() => hook() as unknown as MutacaoGenerica, { wrapper });
    await expect(result.current.mutateAsync(arg)).rejects.toEqual(ERRO);
  });
});

describe("useFluxosDisciplinas", () => {
  it("normaliza etapas (formato atual e legado) em disciplinas", async () => {
    supabaseFake.respond("fluxos_disciplinas", "select", {
      data: [
        { id: "f1", nome: "Atual", etapas: [{ ordem: 1, nome: "Civil" }] },
        { id: "f2", nome: "Legado", etapas: [{ nome: "Etapa", disciplinas: ["MEP"] }] },
        { id: "f3", nome: "Vazio", etapas: null },
      ],
    });
    const { result } = renderHook(() => useFluxosDisciplinas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [atual, legado, vazio] = result.current.data!;
    expect(atual.disciplinas[0]).toMatchObject({ nome: "Civil", ordem: 1 });
    expect(legado.disciplinas[0]).toMatchObject({ nome: "MEP", ordem: 1 });
    expect(vazio.disciplinas).toEqual([]);
  });

  it("data nula vira lista vazia", async () => {
    supabaseFake.respond("fluxos_disciplinas", "select", { data: null });
    const { result } = renderHook(() => useFluxosDisciplinas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga erro", async () => {
    supabaseFake.respond("fluxos_disciplinas", "select", { error: ERRO });
    const { result } = renderHook(() => useFluxosDisciplinas(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("cria gravando disciplinas na coluna etapas", async () => {
    supabaseFake.respond("fluxos_disciplinas", "insert", { data: { id: "novo" } });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateFluxo(), { wrapper });
    const disciplinas = [{ ordem: 1, nome: "Civil" }];
    await act(() => result.current.mutateAsync({ nome: "F", disciplinas }));
    expect(supabaseFake.callsTo("fluxos_disciplinas", "insert")[0].payload).toEqual({
      nome: "F",
      descricao: null,
      etapas: disciplinas,
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["fluxos-disciplinas"] });
  });

  it("atualiza e exclui pelo id", async () => {
    const upd = renderHook(() => useUpdateFluxo(), { wrapper });
    await act(() => upd.result.current.mutateAsync({ id: "f1", nome: "F", descricao: "d", disciplinas: [] }));
    const call = supabaseFake.callsTo("fluxos_disciplinas", "update")[0];
    expect(call.payload).toEqual({ nome: "F", descricao: "d", etapas: [] });
    expect(call.chain).toContainEqual(["eq", ["id", "f1"]]);

    const del = renderHook(() => useDeleteFluxo(), { wrapper });
    await act(() => del.result.current.mutateAsync("f1"));
    expect(supabaseFake.callsTo("fluxos_disciplinas", "delete")[0].chain).toContainEqual(["eq", ["id", "f1"]]);
  });

  it.each([
    ["insert", () => useCreateFluxo(), { nome: "F", disciplinas: [] }],
    ["update", () => useUpdateFluxo(), { id: "f1", nome: "F", disciplinas: [] }],
    ["delete", () => useDeleteFluxo(), "f1"],
  ] as const)("erro no %s é propagado", async (op, hook, arg) => {
    supabaseFake.respond("fluxos_disciplinas", op, { error: ERRO });
    const { result } = renderHook(() => hook() as unknown as MutacaoGenerica, { wrapper });
    await expect(result.current.mutateAsync(arg)).rejects.toEqual(ERRO);
  });
});
