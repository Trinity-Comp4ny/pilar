import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { agruparPorEtapa, colunaDaEtapa, useItensTrabalho, type ItemTrabalho } from "./useItensTrabalho";
import { useEtapaMutations, useEtapas, type Etapa } from "./useEtapas";

/**
 * Board unificado: tarefas e disciplinas viram ItemTrabalho, o filtro de tipo
 * e o módulo Projetos decidem o que entra, e cada item cai na coluna certa.
 * Etapas: leitura ordenada e as mutações (com a empresa do perfil).
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  rpc: vi.fn(),
  calls: [] as ChainQuery[],
  profile: { empresa_id: "e1" } as { empresa_id: string } | null,
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: h.profile }) }));

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

const TAREFA = {
  id: "t1",
  numero: 7,
  titulo: "Revisar",
  status: "fazendo",
  prioridade: "alta",
  responsavel_id: "pe9",
  projeto_id: "p1",
  etapa_id: "x1",
  prazo: null,
  horas_estimadas: 3,
  horas_reais: null,
  labels: ["urgente"],
  links: [{ url: "https://a" }],
  comentarios: [{ id: "c" }, { id: "d" }],
  projeto: null,
  responsaveis: [],
  obra: { id: "o1", nome: "Obra Aurora" },
  servico: null,
};

const DISCIPLINA = {
  id: "d1",
  titulo: "Estrutural",
  status_bucket: "concluida",
  status_raw: "Concluído",
  prioridade: "baixa",
  prazo: "2026-12-01",
  projeto_id: "p1",
  projeto_nome: "Casa",
  responsavel_id: "pe1",
  responsavel_nome: "Rita",
  labels: [],
  links: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.profile = { empresa_id: "e1" };
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  h.resolve.mockImplementation((q) => {
    if (q.table === "tarefas") return { data: [TAREFA] };
    if (q.table === "pessoas") return { data: [{ id: "pe9", nome: "Bruno", profile_id: null, profiles: null }] };
    return { data: [] };
  });
  h.rpc.mockResolvedValue({ data: [DISCIPLINA], error: null });
});

describe("useItensTrabalho", () => {
  it("funde tarefa e disciplina com os campos de cada origem", async () => {
    const { result } = renderHook(() => useItensTrabalho(null, { comDisciplinas: true, tipo: "tudo" }), { wrapper });
    await waitFor(() => expect(result.current.itens).toHaveLength(2));
    await waitFor(() => expect(result.current.itens[0].responsavelNome).toBe("Bruno"));
    const [t, d] = result.current.itens;
    expect(t).toMatchObject({
      key: "tarefa:t1",
      numero: 7,
      projetoId: "p1",
      projetoNome: null,
      obraCaminho: "Obra Aurora",
      responsavelId: "pe9",
      comentarios: 2,
      links: 1,
    });
    expect(d).toMatchObject({
      key: "disciplina:d1",
      numero: null,
      status: "concluida",
      responsaveis: [{ id: "pe1", nome: "Rita" }],
      etapaId: null,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("filtro de tipo e módulo Projetos desligado limitam o que entra", async () => {
    const soTarefa = renderHook(() => useItensTrabalho(null, { comDisciplinas: true, tipo: "tarefa" }), { wrapper });
    await waitFor(() => expect(soTarefa.result.current.itens.map((i) => i.tipo)).toEqual(["tarefa"]));

    const soDisc = renderHook(() => useItensTrabalho(null, { comDisciplinas: true, tipo: "disciplina" }), {
      wrapper,
    });
    await waitFor(() => expect(soDisc.result.current.itens.map((i) => i.tipo)).toEqual(["disciplina"]));

    h.rpc.mockClear();
    qc.clear();
    const semProjetos = renderHook(() => useItensTrabalho(["pe1"], { comDisciplinas: false, tipo: "tudo" }), {
      wrapper,
    });
    await waitFor(() => expect(semProjetos.result.current.isLoading).toBe(false));
    expect(h.rpc).not.toHaveBeenCalled();
    expect(semProjetos.result.current.itens.every((i) => i.tipo === "tarefa")).toBe(true);
  });

  it("erro das disciplinas só conta quando o módulo está ligado", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const ligado = renderHook(() => useItensTrabalho(null, { comDisciplinas: true, tipo: "tudo" }), { wrapper });
    await waitFor(() => expect(ligado.result.current.isError).toBe(true));
  });

  it("erro das tarefas vira erro do board", async () => {
    h.resolve.mockReturnValue({ error: { message: "rls" } });
    const r = renderHook(() => useItensTrabalho(null, { comDisciplinas: false, tipo: "tudo" }), { wrapper });
    await waitFor(() => expect(r.result.current.isError).toBe(true));
  });
});

describe("colunas do board", () => {
  const ETAPAS: Etapa[] = [
    { id: "e-fazer", nome: "A fazer", ordem: 0, cor: null, bucket: "a_fazer" },
    { id: "x1", nome: "Revisão", ordem: 1, cor: "#000", bucket: null },
    { id: "e-fazendo", nome: "Fazendo", ordem: 2, cor: null, bucket: "fazendo" },
    { id: "e-ok", nome: "Concluído", ordem: 3, cor: null, bucket: "concluida" },
  ];
  const item = (p: Partial<ItemTrabalho>) =>
    ({ tipo: "tarefa", etapaId: null, status: "a_fazer", ...p }) as ItemTrabalho;

  it("sem etapas não há coluna", () => {
    expect(colunaDaEtapa(item({}), [])).toBeNull();
  });

  it("tarefa vai para a sua etapa, ou para 'A fazer' se não tiver ou estiver órfã", () => {
    expect(colunaDaEtapa(item({ etapaId: "x1" }), ETAPAS)).toBe("x1");
    expect(colunaDaEtapa(item({ etapaId: null }), ETAPAS)).toBe("e-fazer");
    expect(colunaDaEtapa(item({ etapaId: "apagada" }), ETAPAS)).toBe("e-fazer");
  });

  it("disciplina cai na âncora do seu balde, ou na primeira coluna", () => {
    expect(colunaDaEtapa(item({ tipo: "disciplina", status: "concluida" }), ETAPAS)).toBe("e-ok");
    const semAncoras = ETAPAS.map((e) => ({ ...e, bucket: null }));
    expect(colunaDaEtapa(item({ tipo: "disciplina", status: "fazendo" }), semAncoras)).toBe("e-fazer");
    // Sem âncora "A fazer", tarefa sem etapa cai na primeira coluna.
    expect(colunaDaEtapa(item({}), semAncoras)).toBe("e-fazer");
  });

  it("agrupa todos os itens nas colunas, na ordem das etapas", () => {
    const grupos = agruparPorEtapa(
      [
        item({ key: "a", etapaId: "x1" }),
        item({ key: "b", tipo: "disciplina", status: "fazendo" }),
        item({ key: "c" }),
      ],
      ETAPAS
    );
    expect(grupos.map((g) => [g.titulo, g.itens.map((i) => i.key)])).toEqual([
      ["A fazer", ["c"]],
      ["Revisão", ["a"]],
      ["Fazendo", ["b"]],
      ["Concluído", []],
    ]);
  });
});

describe("useEtapas", () => {
  it("lê em ordem e normaliza o balde ausente", async () => {
    h.resolve.mockReturnValue({ data: [{ id: "e1", nome: "Extra", ordem: 0, cor: null, bucket: undefined }] });
    const { result } = renderHook(() => useEtapas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].bucket).toBeNull();
    expect(h.calls[0].filters).toContainEqual(["order", "ordem", { ascending: true }]);
  });

  it("erro na leitura vira erro", async () => {
    h.resolve.mockReturnValue({ error: { message: "x" } });
    const { result } = renderHook(() => useEtapas(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("criar usa a empresa do perfil e exige perfil", async () => {
    h.resolve.mockReturnValue({ data: { id: "n1", nome: "Nova", ordem: 4, cor: null, bucket: null } });
    const { result } = renderHook(() => useEtapaMutations(), { wrapper });
    const etapa = await result.current.criar.mutateAsync({ nome: "Nova", ordem: 4 });
    expect(etapa.id).toBe("n1");
    expect(h.calls.find((c) => c.op === "insert")!.payload).toEqual({
      empresa_id: "e1",
      nome: "Nova",
      ordem: 4,
      cor: null,
    });

    h.profile = null;
    const r2 = renderHook(() => useEtapaMutations(), { wrapper });
    await expect(r2.result.current.criar.mutateAsync({ nome: "X", ordem: 0 })).rejects.toThrow("Sem empresa no perfil");
  });

  it("editar, reordenar e excluir gravam e invalidam; erro interrompe a reordenação", async () => {
    h.resolve.mockReturnValue({});
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useEtapaMutations(), { wrapper });
    await result.current.editar.mutateAsync({ id: "e1", nome: "Revisão", cor: "#fff" });
    await result.current.reordenar.mutateAsync([
      { id: "e1", ordem: 1 },
      { id: "e2", ordem: 0 },
    ]);
    await result.current.excluir.mutateAsync("e1");
    const updates = h.calls.filter((c) => c.op === "update");
    expect(updates.map((u) => u.payload)).toEqual([{ nome: "Revisão", cor: "#fff" }, { ordem: 1 }, { ordem: 0 }]);
    expect(h.calls.find((c) => c.op === "delete")!.filters).toContainEqual(["eq", "id", "e1"]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["meu-trabalho", "tarefas"] });

    h.calls.length = 0;
    h.resolve.mockReturnValue({ error: { message: "rls" } });
    await expect(
      result.current.reordenar.mutateAsync([
        { id: "e1", ordem: 1 },
        { id: "e2", ordem: 0 },
      ])
    ).rejects.toBeTruthy();
    expect(h.calls).toHaveLength(1);
    await expect(result.current.editar.mutateAsync({ id: "e1", nome: "x", cor: "#000" })).rejects.toBeTruthy();
    await expect(result.current.excluir.mutateAsync("e1")).rejects.toBeTruthy();
  });
});
