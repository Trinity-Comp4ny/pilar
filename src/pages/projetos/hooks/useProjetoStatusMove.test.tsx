import { type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type Projeto } from "@/types/projetos";
import { type ProjetoEtapa } from "./useProjetoEtapas";

// SPEC 142: a regra de mover o projeto de etapa é uma só (`moverParaEtapa`), usada pelo
// arraste do quadro e pela Lista. Pausar, retomar e reabrir pedem confirmação; o resto grava.

const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: mockUpdate }) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useProjetoStatusMove } from "./useProjetoStatusMove";

const etapas: ProjetoEtapa[] = [
  { id: "e-and", nome: "Em andamento", ordem: 1, cor: null, bucket: "Em andamento" },
  { id: "e-par", nome: "Paralisado", ordem: 2, cor: null, bucket: "Paralisado" },
  { id: "e-con", nome: "Concluído", ordem: 3, cor: null, bucket: "Concluído" },
  { id: "e-rev", nome: "Revisão", ordem: 4, cor: null, bucket: "Revisão" },
];

const projeto = (id: string, etapa_id: string | null, status: Projeto["status"]) =>
  ({ id, nome: `Projeto ${id}`, etapa_id, status, data_previsao: "2026-12-20", data_final: "2026-10-30" }) as Projeto;

const projetos = [
  projeto("p-and", "e-and", "Em andamento"),
  projeto("p-par", "e-par", "Paralisado"),
  projeto("p-con", "e-con", "Concluído"),
  projeto("p-legado", null, "Concluído"),
];

function montar(canEdit = true) {
  const qc = new QueryClient();
  qc.setQueryData(["projetos"], projetos);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProjetoStatusMove(projetos, canEdit, etapas), { wrapper });
}

describe("moverParaEtapa", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockEq.mockClear();
  });

  it("move direto e grava a etapa quando nenhuma regra se aplica", async () => {
    const { result } = montar();
    await act(() => result.current.moverParaEtapa("p-and", "e-rev"));

    expect(mockUpdate).toHaveBeenCalledWith({ etapa_id: "e-rev" });
    expect(mockEq).toHaveBeenCalledWith("id", "p-and");
  });

  it("escolher a etapa atual não grava nada", async () => {
    const { result } = montar();
    await act(() => result.current.moverParaEtapa("p-and", "e-and"));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("para Paralisado abre o diálogo de pausa e não grava", async () => {
    const { result } = montar();
    await act(() => result.current.moverParaEtapa("p-and", "e-par"));

    expect(result.current.pendingPausa).toEqual({ projetoId: "p-and", projetoNome: "Projeto p-and" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("de Paralisado para outra etapa abre a retomada", async () => {
    const { result } = montar();
    await act(() => result.current.moverParaEtapa("p-par", "e-and"));

    expect(result.current.pendingRetomada).toMatchObject({ projetoId: "p-par", etapaId: "e-and" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("de Concluído para outra etapa pede confirmação e não zera data_final antes dela", async () => {
    const { result } = montar();
    await act(() => result.current.moverParaEtapa("p-con", "e-and"));

    expect(result.current.pendingReopen).toMatchObject({
      projetoId: "p-con",
      etapaId: "e-and",
      newStatus: "Em andamento",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("projeto sem etapa parte do status legado dele", async () => {
    const { result } = montar();
    await act(() => result.current.moverParaEtapa("p-legado", "e-and"));

    expect(result.current.pendingReopen).toMatchObject({ projetoId: "p-legado" });
  });

  it("sem permissão de editar não faz nada", async () => {
    const { result } = montar(false);
    await act(() => result.current.moverParaEtapa("p-and", "e-rev"));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result.current.pendingPausa).toBeNull();
  });

  it("o arraste do quadro usa a mesma regra", async () => {
    const { result } = montar();
    await act(() =>
      result.current.onDragEnd({
        draggableId: "p-and",
        source: { droppableId: "e-and", index: 0 },
        destination: { droppableId: "e-par", index: 0 },
      } as never)
    );

    expect(result.current.pendingPausa).toMatchObject({ projetoId: "p-and" });
  });
});
