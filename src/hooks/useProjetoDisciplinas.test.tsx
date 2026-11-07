import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

import {
  useProjetoDisciplinas,
  useUpsertDisciplina,
  useDeleteDisciplina,
  useUpdateDisciplinaStatus,
  useBulkSaveDisciplinas,
  useAplicarFluxoNoProjeto,
} from "./useProjetoDisciplinas";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const ERRO = { message: "permission denied for table projeto_disciplinas", code: "42501" };

const rpcSync = () => supabaseFake.rpcCalls.filter((c) => c.fn === "sync_disciplina_responsaveis");

beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("useProjetoDisciplinas", () => {
  it("sem projetoId não consulta", () => {
    const { result } = renderHook(() => useProjetoDisciplinas(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("mapeia linhas preenchendo defaults e responsáveis", async () => {
    supabaseFake.respond("projeto_disciplinas", "select", {
      data: [
        {
          id: "d1",
          projeto_id: "p1",
          nome: "Estrutural",
          horas_realizadas: null,
          labels: null,
          links: null,
          comentarios: null,
          projeto_disciplina_responsaveis: [{ pessoa_id: "pe1", pessoas: { id: "pe1", nome: "Ana" } }],
        },
        { id: "d2", projeto_id: "p1", nome: "MEP", horas_realizadas: 3, labels: ["x"] },
      ],
    });
    const { result } = renderHook(() => useProjetoDisciplinas("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]).toMatchObject({
      id: "d1",
      horas_realizadas: 0,
      labels: [],
      links: [],
      comentarios: [],
      responsaveis: [{ id: "pe1", nome: "Ana" }],
    });
    expect(result.current.data?.[1]).toMatchObject({ horas_realizadas: 3, labels: ["x"], responsaveis: [] });
    expect(supabaseFake.calls[0].chain).toContainEqual(["eq", ["projeto_id", "p1"]]);
  });

  it("data nula vira lista vazia", async () => {
    supabaseFake.respond("projeto_disciplinas", "select", { data: null });
    const { result } = renderHook(() => useProjetoDisciplinas("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga erro do supabase", async () => {
    supabaseFake.respond("projeto_disciplinas", "select", { error: ERRO });
    const { result } = renderHook(() => useProjetoDisciplinas("p1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(ERRO);
  });
});

describe("useUpsertDisciplina", () => {
  it("sem id: insere com defaults e sincroniza responsáveis", async () => {
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "nova" } });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpsertDisciplina(), { wrapper });

    let id: string | undefined;
    await act(async () => {
      id = await result.current.mutateAsync({ projeto_id: "p1", nome: "Civil", ordem_etapa: 2 });
    });

    expect(id).toBe("nova");
    expect(supabaseFake.callsTo("projeto_disciplinas", "insert")[0].payload).toMatchObject({
      projeto_id: "p1",
      nome: "Civil",
      status: "Não Iniciado",
      data_inicio: null,
      horas_estimadas: 0,
      horas_realizadas: 0,
      labels: [],
      links: [],
      comentarios: [],
      ordem_etapa: 2,
    });
    expect(rpcSync()[0].args).toEqual({ p_disciplina_id: "nova", p_pessoa_ids: [] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["projeto-disciplinas", "p1"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["projetos"] });
  });

  it("sem id e sem ordem_etapa: não envia ordem_etapa", async () => {
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "n" } });
    const { result } = renderHook(() => useUpsertDisciplina(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        projeto_id: "p1",
        nome: "X",
        horas_realizadas: 4,
        labels: ["a"],
        links: [],
        comentarios: [],
        descricao: "d",
        observacoes: "o",
      })
    );
    const payload = supabaseFake.callsTo("projeto_disciplinas", "insert")[0].payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("ordem_etapa");
    expect(payload).toMatchObject({ horas_realizadas: 4, labels: ["a"], descricao: "d", observacoes: "o" });
  });

  it("com id: atualiza só os campos informados (não apaga observações)", async () => {
    const { result } = renderHook(() => useUpsertDisciplina(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ id: "d1", projeto_id: "p1", nome: "Civil", responsavel_ids: ["pe1"] })
    );

    const upd = supabaseFake.callsTo("projeto_disciplinas", "update")[0];
    const payload = upd.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("observacoes");
    expect(payload).not.toHaveProperty("labels");
    expect(payload).not.toHaveProperty("ordem_etapa");
    expect(upd.chain).toContainEqual(["eq", ["id", "d1"]]);
    expect(rpcSync()[0].args).toEqual({ p_disciplina_id: "d1", p_pessoa_ids: ["pe1"] });
  });

  it("com id e campos opcionais: grava todos", async () => {
    const { result } = renderHook(() => useUpsertDisciplina(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        id: "d1",
        projeto_id: "p1",
        nome: "Civil",
        observacoes: "",
        labels: ["l"],
        links: [],
        horas_realizadas: 2,
        descricao: "",
        comentarios: [],
        ordem_etapa: 0,
      })
    );
    expect(supabaseFake.callsTo("projeto_disciplinas", "update")[0].payload).toMatchObject({
      observacoes: null,
      labels: ["l"],
      links: [],
      horas_realizadas: 2,
      descricao: null,
      comentarios: [],
      ordem_etapa: 0,
    });
  });

  it("erro no update: rejeita sem sincronizar responsáveis", async () => {
    supabaseFake.respond("projeto_disciplinas", "update", { error: ERRO });
    const { result } = renderHook(() => useUpsertDisciplina(), { wrapper });
    await expect(result.current.mutateAsync({ id: "d1", projeto_id: "p1", nome: "X" })).rejects.toEqual(ERRO);
    expect(rpcSync()).toHaveLength(0);
  });

  it("erro no insert: rejeita", async () => {
    supabaseFake.respond("projeto_disciplinas", "insert", { error: ERRO });
    const { result } = renderHook(() => useUpsertDisciplina(), { wrapper });
    await expect(result.current.mutateAsync({ projeto_id: "p1", nome: "X" })).rejects.toEqual(ERRO);
  });

  it("erro no RPC de responsáveis: rejeita", async () => {
    supabaseFake.respondRpc("sync_disciplina_responsaveis", { error: { message: "rpc falhou" } });
    const { result } = renderHook(() => useUpsertDisciplina(), { wrapper });
    await expect(result.current.mutateAsync({ id: "d1", projeto_id: "p1", nome: "X" })).rejects.toEqual({
      message: "rpc falhou",
    });
  });
});

describe("useDeleteDisciplina", () => {
  it("apaga e invalida", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteDisciplina(), { wrapper });
    await act(() => result.current.mutateAsync({ id: "d1", projetoId: "p1" }));
    expect(supabaseFake.callsTo("projeto_disciplinas", "delete")[0].chain).toContainEqual(["eq", ["id", "d1"]]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["projeto-disciplinas", "p1"] });
  });

  it("propaga erro", async () => {
    supabaseFake.respond("projeto_disciplinas", "delete", { error: ERRO });
    const { result } = renderHook(() => useDeleteDisciplina(), { wrapper });
    await expect(result.current.mutateAsync({ id: "d1", projetoId: "p1" })).rejects.toEqual(ERRO);
  });
});

describe("useUpdateDisciplinaStatus", () => {
  it("atualização otimista no cache e grava campos opcionais", async () => {
    client.setQueryData(
      ["projeto-disciplinas", "p1"],
      [
        { id: "d1", status: "Não Iniciado" },
        { id: "d2", status: "Não Iniciado" },
      ]
    );
    const { result } = renderHook(() => useUpdateDisciplinaStatus(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        id: "d1",
        projetoId: "p1",
        status: "Concluído",
        justificativa_atraso: "chuva",
        data_fim_real: "2026-01-02",
      })
    );
    expect(client.getQueryData(["projeto-disciplinas", "p1"])).toEqual([
      { id: "d1", status: "Concluído", justificativa_atraso: "chuva", data_fim_real: "2026-01-02" },
      { id: "d2", status: "Não Iniciado" },
    ]);
    expect(supabaseFake.callsTo("projeto_disciplinas", "update")[0].payload).toMatchObject({
      status: "Concluído",
      justificativa_atraso: "chuva",
      data_fim_real: "2026-01-02",
    });
  });

  it("sem campos opcionais: payload só com status", async () => {
    client.setQueryData(["projeto-disciplinas", "p1"], [{ id: "d1", status: "A" }]);
    const { result } = renderHook(() => useUpdateDisciplinaStatus(), { wrapper });
    await act(() => result.current.mutateAsync({ id: "d1", projetoId: "p1", status: "B" }));
    const payload = supabaseFake.callsTo("projeto_disciplinas", "update")[0].payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["status", "updated_at"]);
    expect(client.getQueryData(["projeto-disciplinas", "p1"])).toEqual([{ id: "d1", status: "B" }]);
  });

  it("cache não-array fica intocado", async () => {
    const { result } = renderHook(() => useUpdateDisciplinaStatus(), { wrapper });
    await act(() => result.current.mutateAsync({ id: "d1", projetoId: "p1", status: "B" }));
    expect(client.getQueryData(["projeto-disciplinas", "p1"])).toBeUndefined();
  });

  it("erro restaura o snapshot", async () => {
    const original = [{ id: "d1", status: "A" }];
    client.setQueryData(["projeto-disciplinas", "p1"], original);
    supabaseFake.respond("projeto_disciplinas", "update", { error: ERRO });
    const { result } = renderHook(() => useUpdateDisciplinaStatus(), { wrapper });
    await expect(result.current.mutateAsync({ id: "d1", projetoId: "p1", status: "B" })).rejects.toEqual(ERRO);
    expect(client.getQueryData(["projeto-disciplinas", "p1"])).toEqual(original);
  });

  it("erro sem snapshot não grava nada no cache", async () => {
    supabaseFake.respond("projeto_disciplinas", "update", { error: ERRO });
    const { result } = renderHook(() => useUpdateDisciplinaStatus(), { wrapper });
    await expect(result.current.mutateAsync({ id: "d1", projetoId: "p1", status: "B" })).rejects.toEqual(ERRO);
    expect(client.getQueryData(["projeto-disciplinas", "p1"])).toBeUndefined();
  });
});

describe("useBulkSaveDisciplinas", () => {
  it("apaga as removidas, atualiza existentes, insere novas com checklist e responsáveis por tarefa", async () => {
    supabaseFake.respond("projeto_disciplinas", "select", { data: [{ id: "d1" }, { id: "d-old" }] });
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "d-new" } });
    supabaseFake.respond("projeto_disciplina_checklist", "insert", { data: [{ id: "c1" }, { id: "c2" }] });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useBulkSaveDisciplinas(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        projetoId: "p1",
        disciplinas: [
          { id: "d1", nome: "Civil", responsavel_ids: ["pe1"], ordem_etapa: 1 },
          {
            nome: "MEP",
            responsavel_ids: [],
            checklist_padrao: [
              { texto: "Briefing", duracao_dias_uteis: 2, responsaveis_ids: ["pe2", "pe3"] },
              { texto: "Entrega" },
            ],
          },
        ],
      })
    );

    expect(supabaseFake.callsTo("projeto_disciplinas", "delete")[0].chain).toContainEqual(["in", ["id", ["d-old"]]]);
    const upd = supabaseFake.callsTo("projeto_disciplinas", "update")[0];
    expect(upd.payload).toMatchObject({ nome: "Civil", status: "Não Iniciado", ordem_etapa: 1, custo_hora: 0 });
    expect(supabaseFake.callsTo("projeto_disciplinas", "insert")[0].payload).toMatchObject({
      projeto_id: "p1",
      nome: "MEP",
    });
    expect(supabaseFake.callsTo("projeto_disciplina_checklist", "insert")[0].payload).toEqual([
      { projeto_disciplina_id: "d-new", texto: "Briefing", duracao_dias_uteis: 2, ordem: 0 },
      { projeto_disciplina_id: "d-new", texto: "Entrega", duracao_dias_uteis: null, ordem: 1 },
    ]);
    expect(supabaseFake.callsTo("projeto_disciplina_checklist_responsaveis", "insert")[0].payload).toEqual([
      { checklist_item_id: "c1", pessoa_id: "pe2" },
      { checklist_item_id: "c1", pessoa_id: "pe3" },
    ]);
    expect(rpcSync().map((c) => c.args)).toEqual([
      { p_disciplina_id: "d1", p_pessoa_ids: ["pe1"] },
      { p_disciplina_id: "d-new", p_pessoa_ids: [] },
    ]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["projeto-disciplinas", "p1"] });
  });

  it("id que não existe mais no banco é inserido; nada apagado quando lista bate", async () => {
    supabaseFake.respond("projeto_disciplinas", "select", { data: null });
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "x" } });
    const { result } = renderHook(() => useBulkSaveDisciplinas(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        projetoId: "p1",
        disciplinas: [{ id: "fantasma", nome: "A", responsavel_ids: [], status: "Em Andamento", ordem_etapa: 3 }],
      })
    );
    expect(supabaseFake.callsTo("projeto_disciplinas", "delete")).toHaveLength(0);
    expect(supabaseFake.callsTo("projeto_disciplinas", "insert")[0].payload).toMatchObject({
      status: "Em Andamento",
      ordem_etapa: 3,
    });
    expect(supabaseFake.callsTo("projeto_disciplina_checklist")).toHaveLength(0);
  });

  it("checklist sem responsáveis por tarefa não insere responsáveis", async () => {
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "n" } });
    supabaseFake.respond("projeto_disciplina_checklist", "insert", { data: null });
    const { result } = renderHook(() => useBulkSaveDisciplinas(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        projetoId: "p1",
        disciplinas: [{ nome: "A", responsavel_ids: [], checklist_padrao: [{ texto: "t" }] }],
      })
    );
    expect(supabaseFake.callsTo("projeto_disciplina_checklist_responsaveis")).toHaveLength(0);
  });

  it("falha ao ler as existentes: rejeita sem apagar nem duplicar", async () => {
    supabaseFake.respond("projeto_disciplinas", "select", { error: ERRO });
    const { result } = renderHook(() => useBulkSaveDisciplinas(), { wrapper });
    await expect(
      result.current.mutateAsync({ projetoId: "p1", disciplinas: [{ id: "d1", nome: "A", responsavel_ids: [] }] })
    ).rejects.toEqual(ERRO);
    expect(supabaseFake.callsTo("projeto_disciplinas", "insert")).toHaveLength(0);
    expect(supabaseFake.callsTo("projeto_disciplinas", "delete")).toHaveLength(0);
  });

  it.each([
    ["delete", { data: [{ id: "d-old" }] }, []],
    ["update", { data: [{ id: "d1" }] }, [{ id: "d1", nome: "A", responsavel_ids: [] }]],
    ["insert", { data: [] }, [{ nome: "A", responsavel_ids: [] }]],
  ] as const)("erro no %s: rejeita", async (op, existentes, disciplinas) => {
    supabaseFake.respond("projeto_disciplinas", "select", existentes);
    supabaseFake.respond("projeto_disciplinas", op, { error: ERRO });
    const { result } = renderHook(() => useBulkSaveDisciplinas(), { wrapper });
    await expect(
      result.current.mutateAsync({
        projetoId: "p1",
        disciplinas: disciplinas.map((d) => ({ ...d, responsavel_ids: [] })),
      })
    ).rejects.toEqual(ERRO);
  });

  it("erro no checklist: rejeita", async () => {
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "n" } });
    supabaseFake.respond("projeto_disciplina_checklist", "insert", { error: ERRO });
    const { result } = renderHook(() => useBulkSaveDisciplinas(), { wrapper });
    await expect(
      result.current.mutateAsync({
        projetoId: "p1",
        disciplinas: [{ nome: "A", responsavel_ids: [], checklist_padrao: [{ texto: "t" }] }],
      })
    ).rejects.toEqual(ERRO);
  });

  it("erro nos responsáveis do checklist: rejeita", async () => {
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "n" } });
    supabaseFake.respond("projeto_disciplina_checklist", "insert", { data: [{ id: "c1" }] });
    supabaseFake.respond("projeto_disciplina_checklist_responsaveis", "insert", { error: ERRO });
    const { result } = renderHook(() => useBulkSaveDisciplinas(), { wrapper });
    await expect(
      result.current.mutateAsync({
        projetoId: "p1",
        disciplinas: [{ nome: "A", responsavel_ids: [], checklist_padrao: [{ texto: "t", responsaveis_ids: ["pe"] }] }],
      })
    ).rejects.toEqual(ERRO);
  });
});

describe("useAplicarFluxoNoProjeto", () => {
  it("cria novas, encaixa existentes e invalida mesmo em sucesso", async () => {
    supabaseFake.respond("projeto_disciplinas", "insert", { data: { id: "n1" } });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAplicarFluxoNoProjeto(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        projetoId: "p1",
        plano: {
          novas: [{ nome: "Nova", responsavel_ids: ["pe1"], ordem_etapa: 1 }],
          encaixadas: [{ id: "e1", nome: "Existente", ordem_etapa: 2 }],
        },
      } as never)
    );
    expect(rpcSync()[0].args).toEqual({ p_disciplina_id: "n1", p_pessoa_ids: ["pe1"] });
    const upd = supabaseFake.callsTo("projeto_disciplinas", "update")[0];
    expect(upd.payload).toMatchObject({ ordem_etapa: 2 });
    expect(upd.chain).toContainEqual(["eq", ["id", "e1"]]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["projeto-disciplina-checklist-counts", "p1"] });
  });

  it("erro ao encaixar: rejeita e ainda invalida", async () => {
    supabaseFake.respond("projeto_disciplinas", "update", { error: ERRO });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAplicarFluxoNoProjeto(), { wrapper });
    await expect(
      result.current.mutateAsync({
        projetoId: "p1",
        plano: { novas: [], encaixadas: [{ id: "e1", nome: "E", ordem_etapa: 2 }] },
      })
    ).rejects.toEqual(ERRO);
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["projeto-disciplinas", "p1"] }));
  });
});
