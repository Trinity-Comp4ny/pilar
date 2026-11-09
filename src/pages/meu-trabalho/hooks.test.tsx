import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import {
  useDisciplinas,
  usePessoasEmpresa,
  useProjetosLite,
  useSetDisciplinaStatus,
  useTarefaMutations,
  useTarefaPorId,
  useTarefas,
} from "./hooks";

/**
 * Hooks de dados de "Tarefas": filtros por pessoa (inclusive o caso "eu sem
 * pessoa vinculada"), normalização do embed do PostgREST, mescla de
 * disciplinas por pessoa e a ponte de responsáveis nas mutações.
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  rpc: vi.fn(),
  calls: [] as ChainQuery[],
  profile: { empresa_id: "e1" } as { empresa_id: string | null } | null,
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

const chamadas = (table: string, op?: ChainQuery["op"]) =>
  h.calls.filter((c) => c.table === table && (!op || c.op === op));

const LINHA = {
  id: "t1",
  numero: 42,
  titulo: "Revisar prancha",
  status: "fazendo",
  prioridade: "urgente",
  labels: null,
  links: null,
  comentarios: null,
  projeto: [{ id: "p1", nome: "Casa Ipê" }],
  responsaveis: [{ pessoa: { id: "pe1", nome: "Rita" } }, { pessoa: [{ id: "pe2", nome: "Davi" }] }, { pessoa: null }],
  obra: [{ id: "o1", nome: "Obra Aurora" }],
  servico: { nome: "Alvenaria", etapa: [{ nome: "Estrutura", fase: { nome: "Execução" } }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.profile = { empresa_id: "e1" };
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  h.resolve.mockReturnValue({ data: [] });
  h.rpc.mockResolvedValue({ data: [], error: null });
});

describe("useTarefas", () => {
  it("sem filtro busca tudo e normaliza o embed", async () => {
    h.resolve.mockReturnValue({ data: [LINHA] });
    const { result } = renderHook(() => useTarefas(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [t] = result.current.data!;
    expect(t.prioridade).toBe("media");
    expect(t.responsaveis.map((r) => r.id)).toEqual(["pe1", "pe2"]);
    expect(t.projeto).toEqual({ id: "p1", nome: "Casa Ipê" });
    expect(t.obra).toEqual({ id: "o1", nome: "Obra Aurora" });
    expect(t.obra_caminho).toBe("Execução › Estrutura › Alvenaria");
    expect(t.labels).toEqual([]);
    expect(t.comentarios).toEqual([]);
    expect(chamadas("tarefa_responsaveis")).toHaveLength(0);
  });

  it("serviço sem fase monta o caminho só com o que existe; sem serviço é null", async () => {
    h.resolve.mockReturnValue({
      data: [
        { ...LINHA, id: "a", servico: [{ nome: "Pintura", etapa: null }], projeto: null, obra: null },
        { ...LINHA, id: "b", servico: null },
      ],
    });
    const { result } = renderHook(() => useTarefas(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].obra_caminho).toBe("Pintura");
    expect(result.current.data![0].projeto).toBeNull();
    expect(result.current.data![1].obra_caminho).toBeNull();
  });

  it("filtro vazio ('eu' sem pessoa vinculada) devolve nada sem consultar", async () => {
    const { result } = renderHook(() => useTarefas([]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(chamadas("tarefa_responsaveis")).toHaveLength(0);
  });

  it("filtro por pessoas busca pela ponte, sem duplicar ids", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "tarefa_responsaveis"
        ? { data: [{ tarefa_id: "t1" }, { tarefa_id: "t1" }, { tarefa_id: "t2" }] }
        : { data: [LINHA] }
    );
    const { result } = renderHook(() => useTarefas(["pe1", "pe2"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(chamadas("tarefa_responsaveis")[0].filters).toContainEqual(["in", "pessoa_id", ["pe1", "pe2"]]);
    expect(chamadas("tarefas")[0].filters).toContainEqual(["in", "id", ["t1", "t2"]]);
  });

  it("pessoa sem tarefa devolve vazio sem consultar tarefas filtradas", async () => {
    h.resolve.mockImplementation((q) => (q.table === "tarefa_responsaveis" ? { data: [] } : { data: [LINHA] }));
    const { result } = renderHook(() => useTarefas(["pe1"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("erro na ponte ou na consulta vira erro da query", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "tarefa_responsaveis" ? { error: { message: "permission denied" } } : { data: [] }
    );
    const { result } = renderHook(() => useTarefas(["pe1"]), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    h.resolve.mockReturnValue({ error: { message: "timeout" } });
    const r2 = renderHook(() => useTarefas(null), { wrapper });
    await waitFor(() => expect(r2.result.current.isError).toBe(true));
  });
});

describe("useTarefaPorId", () => {
  it("sem id não consulta", () => {
    renderHook(() => useTarefaPorId(null), { wrapper });
    expect(h.calls).toHaveLength(0);
  });

  it("não encontrada (ou bloqueada pela RLS) devolve null", async () => {
    h.resolve.mockReturnValue({ data: null });
    const { result } = renderHook(() => useTarefaPorId("t9"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(chamadas("tarefas")[0].filters).toContainEqual(["eq", "id", "t9"]);
  });

  it("encontrada vem normalizada; erro vira erro", async () => {
    h.resolve.mockReturnValue({ data: LINHA });
    const { result } = renderHook(() => useTarefaPorId("t1"), { wrapper });
    await waitFor(() => expect(result.current.data?.numero).toBe(42));
    h.resolve.mockReturnValue({ error: { message: "x" } });
    const r2 = renderHook(() => useTarefaPorId("t2"), { wrapper });
    await waitFor(() => expect(r2.result.current.isError).toBe(true));
  });
});

describe("useDisciplinas", () => {
  const D = (id: string) => ({
    id,
    titulo: `D ${id}`,
    status_bucket: "fazendo",
    status_raw: "Em Andamento",
    prioridade: "ALTA",
    prazo: null,
    projeto_id: "p1",
    projeto_nome: "Casa",
    responsavel_id: undefined,
    responsavel_nome: undefined,
    labels: null,
    links: null,
  });

  it("sem pessoa chama a RPC uma vez com o padrão do usuário", async () => {
    h.rpc.mockResolvedValue({ data: [D("d1")], error: null });
    const { result } = renderHook(() => useDisciplinas(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.rpc).toHaveBeenCalledWith("get_minhas_disciplinas", { p_pessoa_id: undefined });
    expect(result.current.data![0]).toMatchObject({ prioridade: "media", responsavel_id: null, labels: [] });
  });

  it("várias pessoas: uma chamada por pessoa, mesclando sem duplicar", async () => {
    h.rpc.mockImplementation((_fn: string, args: { p_pessoa_id: string }) =>
      Promise.resolve({ data: args.p_pessoa_id === "a" ? [D("d1"), D("d2")] : [D("d2"), D("d3")], error: null })
    );
    const { result } = renderHook(() => useDisciplinas(["a", "b"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(result.current.data!.map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("desabilitada não chama; erro da RPC vira erro", async () => {
    renderHook(() => useDisciplinas(null, { enabled: false }), { wrapper });
    expect(h.rpc).not.toHaveBeenCalled();
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useDisciplinas(["a"]), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("trocar status grava pelo balde e invalida as disciplinas", async () => {
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSetDisciplinaStatus(), { wrapper });
    await result.current.mutateAsync({ disciplinaId: "d1", bucket: "concluida" });
    expect(h.rpc).toHaveBeenCalledWith("set_disciplina_status", { p_disciplina_id: "d1", p_bucket: "concluida" });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["meu-trabalho", "disciplinas"] });
    h.rpc.mockResolvedValue({ error: { message: "sem permissão" } });
    await expect(result.current.mutateAsync({ disciplinaId: "d1", bucket: "fazendo" })).rejects.toBeTruthy();
  });
});

describe("listas auxiliares", () => {
  it("pessoas trazem avatar do perfil quando existe", async () => {
    h.resolve.mockReturnValue({
      data: [
        { id: "pe1", nome: "Rita", profile_id: "u1", profiles: { avatar_url: "https://x/a.png" } },
        { id: "pe2", nome: "Davi", profile_id: null, profiles: null },
      ],
    });
    const { result } = renderHook(() => usePessoasEmpresa(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: "pe1", nome: "Rita", avatarUrl: "https://x/a.png", profileId: "u1" },
      { id: "pe2", nome: "Davi", avatarUrl: null, profileId: null },
    ]);
  });

  it("projetos ignoram excluídos; erro vira erro", async () => {
    h.resolve.mockReturnValue({ data: [{ id: "p1", nome: "Casa" }] });
    const { result } = renderHook(() => useProjetosLite(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(chamadas("projetos")[0].filters).toContainEqual(["is", "deleted_at", null]);

    qc.clear();
    h.resolve.mockReturnValue({ error: { message: "x" } });
    const r2 = renderHook(() => usePessoasEmpresa(), { wrapper });
    const r3 = renderHook(() => useProjetosLite(), { wrapper });
    await waitFor(() => expect(r2.result.current.isError && r3.result.current.isError).toBe(true));
  });
});

describe("useTarefaMutations", () => {
  it("criar exige empresa no perfil", async () => {
    h.profile = null;
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await expect(result.current.criar.mutateAsync({ titulo: "X", status: "a_fazer" })).rejects.toThrow(
      "Sem empresa no perfil"
    );
    expect(h.calls).toHaveLength(0);
  });

  it("criar grava com padrões e reescreve a ponte com o responsável legado", async () => {
    h.resolve.mockImplementation((q) => (q.op === "insert" && q.table === "tarefas" ? { data: { id: "t1" } } : {}));
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    const id = await result.current.criar.mutateAsync({ titulo: "Nova", status: "a_fazer", responsavel_id: "pe1" });
    expect(id).toBe("t1");
    expect(chamadas("tarefas", "insert")[0].payload).toMatchObject({
      empresa_id: "e1",
      titulo: "Nova",
      prioridade: "media",
      responsavel_id: "pe1",
      labels: [],
      prazo: null,
    });
    expect(chamadas("tarefa_responsaveis", "delete")[0].filters).toContainEqual(["eq", "tarefa_id", "t1"]);
    expect(chamadas("tarefa_responsaveis", "insert")[0].payload).toEqual([
      { tarefa_id: "t1", pessoa_id: "pe1", empresa_id: "e1" },
    ]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["meu-trabalho", "tarefas"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["obra_tarefas"] });
  });

  it("criar sem responsável só limpa a ponte; erro no insert não toca a ponte", async () => {
    h.resolve.mockImplementation((q) => (q.op === "insert" ? { data: { id: "t2" } } : {}));
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await result.current.criar.mutateAsync({ titulo: "Solta", status: "a_fazer" });
    expect(chamadas("tarefa_responsaveis", "insert")).toHaveLength(0);

    h.calls.length = 0;
    h.resolve.mockReturnValue({ error: { message: "violates check" } });
    await expect(result.current.criar.mutateAsync({ titulo: "X", status: "a_fazer" })).rejects.toBeTruthy();
    expect(chamadas("tarefa_responsaveis")).toHaveLength(0);
  });

  it("falha ao gravar a ponte propaga o erro", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "tarefas" ? { data: { id: "t1" } } : q.op === "insert" ? { error: { message: "rls" } } : {}
    );
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await expect(
      result.current.criar.mutateAsync({ titulo: "X", status: "a_fazer", responsaveis: ["pe1"] })
    ).rejects.toMatchObject({ message: "rls" });

    h.resolve.mockImplementation((q) => (q.op === "delete" ? { error: { message: "del" } } : { data: { id: "t1" } }));
    await expect(
      result.current.criar.mutateAsync({ titulo: "X", status: "a_fazer", responsaveis: ["pe1"] })
    ).rejects.toMatchObject({ message: "del" });
  });

  it("atualizar manda só os campos presentes e sincroniza responsáveis múltiplos", async () => {
    h.resolve.mockReturnValue({});
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await result.current.atualizar.mutateAsync({
      id: "t1",
      input: { titulo: "T", prazo: null, labels: ["a"], responsaveis: ["pe2", "pe3"], comentarios: [] },
    });
    const patch = chamadas("tarefas", "update")[0];
    expect(patch.payload).toEqual({ titulo: "T", prazo: null, labels: ["a"], comentarios: [], responsavel_id: "pe2" });
    expect(patch.filters).toContainEqual(["eq", "id", "t1"]);
    expect(chamadas("tarefa_responsaveis", "insert")[0].payload).toHaveLength(2);
  });

  it("atualizar só status não mexe na ponte; responsavel_id null esvazia", async () => {
    h.resolve.mockReturnValue({});
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await result.current.atualizar.mutateAsync({ id: "t1", input: { status: "concluida" } });
    expect(chamadas("tarefa_responsaveis")).toHaveLength(0);

    await result.current.atualizar.mutateAsync({ id: "t1", input: { responsavel_id: null } });
    expect(chamadas("tarefas", "update").at(-1)!.payload).toEqual({ responsavel_id: null });
    expect(chamadas("tarefa_responsaveis", "delete")).toHaveLength(1);
    expect(chamadas("tarefa_responsaveis", "insert")).toHaveLength(0);
  });

  it("atualizar sem campos não faz update; trocar responsável sem empresa falha", async () => {
    h.resolve.mockReturnValue({});
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await result.current.atualizar.mutateAsync({ id: "t1", input: {} });
    expect(chamadas("tarefas", "update")).toHaveLength(0);

    h.profile = { empresa_id: null };
    const r2 = renderHook(() => useTarefaMutations(), { wrapper });
    await expect(
      r2.result.current.atualizar.mutateAsync({ id: "t1", input: { responsavel_id: "pe1" } })
    ).rejects.toThrow("Sem empresa no perfil");
  });

  it("erro no update propaga", async () => {
    h.resolve.mockReturnValue({ error: { message: "rls" } });
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await expect(result.current.atualizar.mutateAsync({ id: "t1", input: { titulo: "x" } })).rejects.toBeTruthy();
  });

  it("excluir apaga pelo id; erro propaga", async () => {
    h.resolve.mockReturnValue({});
    const { result } = renderHook(() => useTarefaMutations(), { wrapper });
    await result.current.excluir.mutateAsync("t1");
    expect(chamadas("tarefas", "delete")[0].filters).toContainEqual(["eq", "id", "t1"]);
    h.resolve.mockReturnValue({ error: { message: "fk" } });
    await expect(result.current.excluir.mutateAsync("t1")).rejects.toBeTruthy();
  });
});
