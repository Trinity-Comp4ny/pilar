import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ObraFrenteRow } from "@/pages/obras/hooks/useObraFrentes";

const m = vi.hoisted(() => ({
  createNo: vi.fn(),
  updateNo: vi.fn(),
  deleteNo: vi.fn(),
  createTarefa: vi.fn(),
  updateTarefa: vi.fn(),
  deleteTarefa: vi.fn(),
  atualizarGestao: vi.fn(),
  track: vi.fn(),
  pendente: false,
}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
const mut = (fn: ReturnType<typeof vi.fn>) => ({ mutateAsync: fn, isPending: m.pendente });

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: (...a: unknown[]) => m.track(...a) } }));
vi.mock("@/pages/obras/hooks/useObraFrentes", () => ({
  useCreateFrente: () => mut(m.createNo),
  useUpdateFrente: () => mut(m.updateNo),
  useDeleteFrente: () => mut(m.deleteNo),
}));
vi.mock("@/pages/obras/hooks/useObraTarefas", () => ({
  useCreateObraTarefa: () => mut(m.createTarefa),
  useUpdateObraTarefa: () => mut(m.updateTarefa),
  useDeleteObraTarefa: () => mut(m.deleteTarefa),
}));
vi.mock("@/pages/meu-trabalho/hooks", () => ({ useTarefaMutations: () => ({ atualizar: mut(m.atualizarGestao) }) }));

import { useCronogramaAcoes } from "./useCronogramaAcoes";

const no = (p: Partial<ObraFrenteRow>) =>
  ({
    id: "x",
    parent_id: null,
    nome: "N",
    nivel: "etapa",
    ordem: 0,
    created_at: "2026-01-01",
    data_inicio: null,
    data_fim: null,
    ...p,
  }) as ObraFrenteRow;

const nos = [
  no({ id: "e1", ordem: 0, data_inicio: "2026-02-01", data_fim: "2026-03-01" }),
  no({ id: "e2", ordem: 1 }),
  no({ id: "e3", ordem: 1, created_at: "2026-01-02" }),
  no({ id: "s1", parent_id: "e1", nivel: "servico", ordem: 0 }),
];

let qc: QueryClient;
function montar(lista = nos) {
  qc = new QueryClient();
  vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCronogramaAcoes("obra-1", "proj-1", lista), { wrapper }).result;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.pendente = false;
  for (const f of [
    m.createNo,
    m.updateNo,
    m.deleteNo,
    m.createTarefa,
    m.updateTarefa,
    m.deleteTarefa,
    m.atualizarGestao,
  ]) {
    f.mockResolvedValue(undefined);
  }
});

describe("useCronogramaAcoes: nós", () => {
  it("cria filho com o período do pai e a ordem no fim dos irmãos", async () => {
    const r = montar();
    let ok = false;
    await act(async () => {
      ok = await r.current.criarNo("servico", "e1", "Fundação");
    });
    expect(ok).toBe(true);
    expect(m.createNo).toHaveBeenCalledWith({
      nome: "Fundação",
      nivel: "servico",
      parent_id: "e1",
      ordem: 1,
      data_inicio: "2026-02-01",
      data_fim: "2026-03-01",
    });
    expect(m.track).toHaveBeenCalledWith("cronograma_item_criado", { nivel: "servico" });
  });

  it("cria na raiz sem período; falha avisa e devolve false", async () => {
    m.createNo.mockRejectedValueOnce(new Error("limite"));
    const r = montar();
    let ok = true;
    await act(async () => {
      ok = await r.current.criarNo("etapa", null, "Acabamento");
    });
    expect(ok).toBe(false);
    expect(m.createNo).toHaveBeenCalledWith(expect.objectContaining({ ordem: 3, data_inicio: null, data_fim: null }));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível criar", { description: "limite" });
  });

  it("atualizar nó: erro não-Error usa texto genérico", async () => {
    m.updateNo.mockRejectedValueOnce("x");
    const r = montar();
    await act(() => r.current.atualizarNo({ id: "e1", nome: "Novo" } as never));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "Tente novamente" });
    await act(() => r.current.atualizarNo({ id: "e1", nome: "Novo" } as never));
    expect(m.updateNo).toHaveBeenCalledTimes(2);
  });

  it("move entre irmãos renumerando só quem mudou de posição", async () => {
    const r = montar();
    await act(() => r.current.moverNo("e3", -1));
    // Ordem atual: e1(0), e2(1), e3(1, criado depois). Subir e3 troca com e2: e3 já
    // tem ordem 1 e fica; só e2 (que vai para a posição 2) é regravado.
    expect(m.updateNo).toHaveBeenCalledTimes(1);
    expect(m.updateNo).toHaveBeenCalledWith({ id: "e2", ordem: 2 });
  });

  it("mover além das pontas ou nó inexistente não grava; falha avisa", async () => {
    const r = montar();
    await act(() => r.current.moverNo("e1", -1));
    await act(() => r.current.moverNo("s1", 1));
    await act(() => r.current.moverNo("nao-existe", 1));
    expect(m.updateNo).not.toHaveBeenCalled();

    m.updateNo.mockRejectedValueOnce(new Error("rls"));
    await act(() => r.current.moverNo("e1", 1));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível reordenar", { description: "rls" });
  });

  it("excluir nó devolve true; falha avisa e devolve false", async () => {
    const r = montar();
    let ok = false;
    await act(async () => {
      ok = await r.current.excluirNo("e2");
    });
    expect(ok).toBe(true);
    m.deleteNo.mockRejectedValueOnce(new Error("tem tarefas"));
    await act(async () => {
      ok = await r.current.excluirNo("e2");
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir", { description: "tem tarefas" });
  });
});

describe("useCronogramaAcoes: tarefas", () => {
  it("cria tarefa no serviço com o período dele; falha avisa", async () => {
    const r = montar();
    const servico = no({ id: "s1", data_inicio: "2026-02-02", data_fim: "2026-02-10" });
    let ok = false;
    await act(async () => {
      ok = await r.current.criarTarefa(servico, "Armar ferragem");
    });
    expect(ok).toBe(true);
    expect(m.createTarefa).toHaveBeenCalledWith({
      titulo: "Armar ferragem",
      obra_frente_id: "s1",
      data_inicio: "2026-02-02",
      prazo: "2026-02-10",
    });
    expect(m.track).toHaveBeenCalledWith("cronograma_item_criado", { nivel: "tarefa" });

    m.createTarefa.mockRejectedValueOnce(new Error("capacidade"));
    await act(async () => {
      ok = await r.current.criarTarefa(no({ id: "s2" }), "Outra");
    });
    expect(ok).toBe(false);
    expect(m.createTarefa).toHaveBeenLastCalledWith(expect.objectContaining({ data_inicio: null, prazo: null }));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível criar a tarefa", { description: "capacidade" });
  });

  it("concluir tarefa registra o evento; outro patch não; falha avisa", async () => {
    const r = montar();
    await act(() => r.current.atualizarTarefa({ id: "t1", status: "concluida" } as never));
    expect(m.track).toHaveBeenCalledWith("cronograma_tarefa_concluida");
    m.track.mockClear();
    await act(() => r.current.atualizarTarefa({ id: "t1", titulo: "x" } as never));
    expect(m.track).not.toHaveBeenCalled();
    m.updateTarefa.mockRejectedValueOnce(new Error("rls"));
    await act(() => r.current.atualizarTarefa({ id: "t1", titulo: "y" } as never));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a tarefa", { description: "rls" });
  });

  it("responsáveis vão pela gestão de tarefas e recarregam a obra; falha avisa", async () => {
    const r = montar();
    await act(() => r.current.definirResponsaveis("t1", ["pe1"]));
    expect(m.atualizarGestao).toHaveBeenCalledWith({ id: "t1", input: { responsaveis: ["pe1"] } });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["obra_tarefas", "obra-1"] });

    m.atualizarGestao.mockRejectedValueOnce(new Error("sem acesso"));
    await act(() => r.current.definirResponsaveis("t1", []));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível trocar o responsável", { description: "sem acesso" });
  });

  it("excluir tarefa devolve true; falha avisa e devolve false", async () => {
    const r = montar();
    let ok = false;
    await act(async () => {
      ok = await r.current.excluirTarefa("t1");
    });
    expect(ok).toBe(true);
    m.deleteTarefa.mockRejectedValueOnce(new Error("rls"));
    await act(async () => {
      ok = await r.current.excluirTarefa("t1");
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir a tarefa", { description: "rls" });
  });

  it("expõe salvando/excluindo a partir das mutações pendentes", () => {
    m.pendente = true;
    const r = montar();
    expect(r.current.salvando).toBe(true);
    expect(r.current.excluindo).toBe(true);
  });
});
