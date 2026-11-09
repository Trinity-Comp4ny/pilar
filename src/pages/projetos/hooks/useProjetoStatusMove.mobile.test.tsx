import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DropResult } from "@hello-pangea/dnd";
import type { Projeto } from "@/types/projetos";
import type { ProjetoEtapa } from "./useProjetoEtapas";

// Complementa useProjetoStatusMove.test: o caminho do mobile (move por status),
// o arraste do quadro (onDragEnd chamado direto), sem permissão, etapa
// desconhecida, falha do banco revertendo o cache e reabertura com data_final.

const mockEq = vi.fn();
const mockUpdate = vi.fn((_: unknown) => ({ eq: mockEq }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: (p: unknown) => mockUpdate(p) }) },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useProjetoStatusMove } from "./useProjetoStatusMove";

const etapas: ProjetoEtapa[] = [
  { id: "e-and", nome: "Fazendo", ordem: 1, cor: null, bucket: "Em andamento" },
  { id: "e-par", nome: "Parado", ordem: 2, cor: null, bucket: "Paralisado" },
  { id: "e-con", nome: "Entregue", ordem: 3, cor: null, bucket: "Concluído" },
];

const projeto = (id: string, status: Projeto["status"], extra: Partial<Projeto> = {}) =>
  ({
    id,
    nome: `Projeto ${id}`,
    etapa_id: null,
    status,
    data_previsao: "2026-12-20",
    data_final: "2026-10-30",
    ...extra,
  }) as Projeto;

const projetos = [
  projeto("p-and", "Em andamento", { etapa_id: "e-and" }),
  projeto("p-par", "Paralisado"),
  projeto("p-con", "Concluído"),
  projeto("p-plan", "Planejamento", { nome: undefined as unknown as string }),
];

let qc: QueryClient;
function montar(opts: { canEdit?: boolean; etapas?: ProjetoEtapa[]; lista?: Projeto[] } = {}) {
  qc = new QueryClient();
  qc.setQueryData(["projetos"], opts.lista ?? projetos);
  vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProjetoStatusMove(opts.lista ?? projetos, opts.canEdit ?? true, opts.etapas ?? etapas), {
    wrapper,
  }).result;
}

const drop = (draggableId: string, origem: string, destino: string | null) =>
  ({
    draggableId,
    source: { droppableId: origem, index: 0 },
    destination: destino ? { droppableId: destino, index: 0 } : null,
  }) as unknown as DropResult;

beforeEach(() => {
  vi.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
});

describe("handleMoveStatus (mobile)", () => {
  it("move pelo status, atualiza o cache e avisa com o rótulo do status", async () => {
    const r = montar();
    await act(() => r.current.handleMoveStatus("p-plan", "Em andamento"));
    expect(mockUpdate).toHaveBeenCalledWith({ status: "Em andamento" });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Movido para /));
    const cache = qc.getQueryData<Projeto[]>(["projetos"])!;
    expect(cache.find((p) => p.id === "p-plan")!.status).toBe("Em andamento");
    expect(cache.find((p) => p.id === "p-and")!.status).toBe("Em andamento");
  });

  it("para Paralisado abre a pausa (com nome padrão quando falta)", async () => {
    const r = montar();
    await act(() => r.current.handleMoveStatus("p-plan", "Paralisado"));
    expect(r.current.pendingPausa).toEqual({ projetoId: "p-plan", projetoNome: "Projeto" });
    await act(() => r.current.handleMoveStatus("nao-existe", "Paralisado"));
    expect(r.current.pendingPausa).toEqual({ projetoId: "nao-existe", projetoNome: "Projeto" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("saindo de Paralisado abre a retomada com a etapa do bucket de destino", async () => {
    const r = montar();
    await act(() => r.current.handleMoveStatus("p-par", "Em andamento"));
    expect(r.current.pendingRetomada).toEqual({ projetoId: "p-par", dataPrevisao: "2026-12-20", etapaId: "e-and" });
    await act(() => r.current.handleMoveStatus("p-par", "Planejamento"));
    expect(r.current.pendingRetomada).toEqual({ projetoId: "p-par", dataPrevisao: "2026-12-20", etapaId: undefined });
  });

  it("saindo de Concluído pede para reabrir", async () => {
    const r = montar();
    await act(() => r.current.handleMoveStatus("p-con", "Em andamento"));
    expect(r.current.pendingReopen).toEqual({
      projetoId: "p-con",
      newStatus: "Em andamento",
      projetoNome: "Projeto p-con",
      dataFinal: "2026-10-30",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("Paralisado → Paralisado e Concluído → Concluído gravam direto", async () => {
    const r = montar();
    await act(() => r.current.handleMoveStatus("p-par", "Paralisado"));
    await act(() => r.current.handleMoveStatus("p-con", "Concluído"));
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    // Concluir revalida a lista (o trigger preenche data_final).
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["projetos"] });
  });
});

describe("applyStatusMove", () => {
  it("reabrir zera data_final no banco e no cache e revalida", async () => {
    const r = montar();
    await act(async () => {
      await r.current.applyStatusMove("p-con", "Em andamento", true, "e-and");
    });
    expect(mockUpdate).toHaveBeenCalledWith({ etapa_id: "e-and", data_final: null });
    expect(toast.success).toHaveBeenCalledWith("Movido para Fazendo");
    const cache = qc.getQueryData<Projeto[]>(["projetos"])!;
    expect(cache.find((p) => p.id === "p-con")).toEqual(
      expect.objectContaining({ data_final: undefined, etapa_id: "e-and" })
    );
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["projetos"] });
  });

  it("status desconhecido usa o próprio texto como rótulo", async () => {
    const r = montar();
    await act(async () => {
      await r.current.applyStatusMove("p-and", "Status novo");
    });
    expect(toast.success).toHaveBeenCalledWith("Movido para Status novo");
  });

  it("erro do banco avisa, revalida para desfazer o otimista e devolve false", async () => {
    mockEq.mockResolvedValueOnce({ error: { message: "rls" } });
    const r = montar();
    let ok = true;
    await act(async () => {
      ok = await r.current.applyStatusMove("p-and", "Planejamento");
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Erro ao mover projeto");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["projetos"] });
  });

  it("cache vazio não quebra o update otimista", async () => {
    const r = montar();
    qc.removeQueries({ queryKey: ["projetos"] });
    await act(async () => {
      await r.current.applyStatusMove("p-and", "Planejamento");
    });
    expect(qc.getQueryData(["projetos"])).toEqual([]);
  });
});

describe("onDragEnd e moverParaEtapa", () => {
  it("soltar fora de uma coluna não faz nada", async () => {
    const r = montar();
    await act(() => r.current.onDragEnd(drop("p-and", "e-and", null)));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("arrastar entre colunas usa a coluna de origem do quadro", async () => {
    const r = montar();
    await act(() => r.current.onDragEnd(drop("p-and", "e-con", "e-and")));
    expect(mockUpdate).not.toHaveBeenCalled();
    await act(() => r.current.onDragEnd(drop("p-and", "e-and", "e-con")));
    expect(mockUpdate).toHaveBeenCalledWith({ etapa_id: "e-con" });
  });

  it("sem permissão ou etapa de destino desconhecida não grava", async () => {
    const semPermissao = montar({ canEdit: false });
    await act(() => semPermissao.current.moverParaEtapa("p-and", "e-con"));
    const r = montar();
    await act(() => r.current.moverParaEtapa("p-and", "nao-existe"));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("projeto legado sem etapa parte do status: Concluído pede reabertura, Paralisado pede retomada", async () => {
    const r = montar();
    await act(() => r.current.moverParaEtapa("p-con", "e-and"));
    expect(r.current.pendingReopen).toEqual(expect.objectContaining({ projetoId: "p-con", etapaId: "e-and" }));
    await act(() => r.current.moverParaEtapa("p-par", "e-and"));
    expect(r.current.pendingRetomada).toEqual({ projetoId: "p-par", dataPrevisao: "2026-12-20", etapaId: "e-and" });
  });

  it("origem explícita fora das etapas não herda o status do projeto", async () => {
    const r = montar();
    await act(() => r.current.moverParaEtapa("p-con", "e-and", "coluna-sumida"));
    expect(r.current.pendingReopen).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith({ etapa_id: "e-and" });
  });

  it("projeto que não está na lista para Paralisado usa nome padrão", async () => {
    const r = montar();
    await act(() => r.current.moverParaEtapa("fantasma", "e-par", null));
    expect(r.current.pendingPausa).toEqual({ projetoId: "fantasma", projetoNome: "Projeto" });
  });
});

describe("sem etapas configuradas", () => {
  it("o hook funciona com a lista padrão vazia", async () => {
    qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const r = renderHook(() => useProjetoStatusMove(projetos, true), { wrapper }).result;
    await act(() => r.current.moverParaEtapa("p-and", "e-and-x"));
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
