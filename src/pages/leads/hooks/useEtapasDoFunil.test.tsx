import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { LeadEtapa } from "./useLeadEtapas";

const criar = { mutateAsync: vi.fn(), isPending: false };
const editar = { mutateAsync: vi.fn(), isPending: false };
const reordenar = { mutateAsync: vi.fn(), isPending: false };
const excluir = { mutateAsync: vi.fn(), isPending: false };

vi.mock("./useLeadEtapas", () => ({
  useLeadEtapaMutations: () => ({ criar, editar, reordenar, excluir }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import { useEtapasDoFunil } from "./useEtapasDoFunil";

const etapa = (id: string, ordem: number, bucket: LeadEtapa["bucket"]): LeadEtapa => ({
  id,
  nome: id,
  ordem,
  cor: null,
  bucket,
});

const ETAPAS = [etapa("novo", 0, "Novo"), etapa("ganho", 1, "Ganho"), etapa("perdido", 2, "Perdido")];

function setup(leadsPorEtapa: Record<string, number> = {}) {
  return renderHook(() => useEtapasDoFunil(ETAPAS, (id) => leadsPorEtapa[id] ?? 0));
}

describe("useEtapasDoFunil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    criar.mutateAsync.mockResolvedValue(undefined);
    editar.mutateAsync.mockResolvedValue(undefined);
    reordenar.mutateAsync.mockResolvedValue(undefined);
    excluir.mutateAsync.mockResolvedValue(undefined);
  });

  it("cria a coluna no fim, com o nome limpo e o bucket escolhido", async () => {
    const { result } = setup();
    let ok = false;
    await act(async () => {
      ok = await result.current.criarEtapa("  Visita técnica ", "#14b8a6", "Em contato");
    });
    expect(ok).toBe(true);
    expect(criar.mutateAsync).toHaveBeenCalledWith({
      nome: "Visita técnica",
      ordem: 3,
      cor: "#14b8a6",
      bucket: "Em contato",
    });
  });

  it("não cria coluna sem nome", async () => {
    const { result } = setup();
    let ok = true;
    await act(async () => {
      ok = await result.current.criarEtapa("   ", "#14b8a6", "Novo");
    });
    expect(ok).toBe(false);
    expect(criar.mutateAsync).not.toHaveBeenCalled();
  });

  it("avisa quando a criação falha", async () => {
    criar.mutateAsync.mockRejectedValue(new Error("x"));
    const { result } = setup();
    let ok = true;
    await act(async () => {
      ok = await result.current.criarEtapa("Reunião", "#14b8a6", "Novo");
    });
    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Não deu para criar a coluna", expect.anything());
  });

  it("salva nome e cor; avisa se falhar", async () => {
    const { result } = setup();
    await act(async () => {
      expect(await result.current.salvarEtapa({ id: "novo", nome: "Primeiro contato", cor: "#fff" })).toBe(true);
    });
    expect(editar.mutateAsync).toHaveBeenCalledWith({ id: "novo", nome: "Primeiro contato", cor: "#fff" });

    editar.mutateAsync.mockRejectedValue(new Error("x"));
    await act(async () => {
      expect(await result.current.salvarEtapa({ id: "novo", nome: "A", cor: "#fff" })).toBe(false);
    });
    expect(toastError).toHaveBeenCalledWith("Não deu para salvar a coluna", expect.anything());
  });

  it("reordena trocando com o vizinho e ignora a ponta", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.reordenarEtapa("ganho", -1);
    });
    expect(reordenar.mutateAsync).toHaveBeenCalledWith([
      { id: "ganho", ordem: 0 },
      { id: "novo", ordem: 1 },
    ]);

    reordenar.mutateAsync.mockClear();
    await act(async () => {
      await result.current.reordenarEtapa("novo", -1);
    });
    expect(reordenar.mutateAsync).not.toHaveBeenCalled();
  });

  it("avisa quando reordenar falha", async () => {
    reordenar.mutateAsync.mockRejectedValue(new Error("x"));
    const { result } = setup();
    await act(async () => {
      await result.current.reordenarEtapa("ganho", -1);
    });
    expect(toastError).toHaveBeenCalledWith("Não deu para reordenar as colunas", expect.anything());
  });

  it("recusa excluir coluna com leads e a última de Ganho, com o motivo na mensagem", () => {
    const { result } = setup({ novo: 2 });
    act(() => result.current.pedirExcluirEtapa(ETAPAS[0]));
    expect(toastError).toHaveBeenCalledWith(
      "Não dá para excluir esta coluna",
      expect.objectContaining({ description: expect.stringContaining("2 leads") })
    );
    expect(result.current.aEtapaExcluir).toBeNull();

    act(() => result.current.pedirExcluirEtapa(ETAPAS[1]));
    expect(toastError).toHaveBeenLastCalledWith(
      "Não dá para excluir esta coluna",
      expect.objectContaining({ description: expect.stringContaining("Ganho") })
    );
  });

  it("pede confirmação para coluna vazia e exclui ao confirmar", async () => {
    const { result } = setup();
    act(() => result.current.pedirExcluirEtapa(ETAPAS[0]));
    expect(result.current.aEtapaExcluir?.id).toBe("novo");

    await act(async () => {
      await result.current.confirmarExcluirEtapa();
    });
    expect(excluir.mutateAsync).toHaveBeenCalledWith("novo");
    expect(toastSuccess).toHaveBeenCalledWith("Coluna excluída");
    expect(result.current.aEtapaExcluir).toBeNull();
  });

  it("mostra a mensagem do banco quando a exclusão é barrada", async () => {
    excluir.mutateAsync.mockRejectedValue({ code: "23503", message: "Mova os leads desta coluna." });
    const { result } = setup();
    act(() => result.current.pedirExcluirEtapa(ETAPAS[0]));
    await act(async () => {
      await result.current.confirmarExcluirEtapa();
    });
    expect(toastError).toHaveBeenCalledWith(
      "Não deu para excluir a coluna",
      expect.objectContaining({ description: "Mova os leads desta coluna." })
    );
  });

  it("confirmar sem coluna escolhida não faz nada", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.confirmarExcluirEtapa();
    });
    expect(excluir.mutateAsync).not.toHaveBeenCalled();
  });
});
