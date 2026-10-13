import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ObraFrenteRow } from "@/hooks/useObraFrentes";
import { ObraCronogramaTab } from "./ObraCronogramaTab";

/**
 * Regressão: o modal da etapa guardava o objeto da etapa no clique. Depois de
 * salvar a data, o Gantt recebia a lista nova mas o campo "Início da etapa"
 * seguia mostrando o snapshot antigo (vazio).
 */

let frentes: ObraFrenteRow[] = [];
// vi.mock sobe pro topo do arquivo; o helper precisa subir junto.
const { mutacao } = vi.hoisted(() => ({
  mutacao: () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false }),
}));

vi.mock("@/hooks/useObraFrentes", () => ({
  useObraFrentes: () => ({ data: frentes, isLoading: false }),
  useCreateFrente: mutacao,
  useUpdateFrente: mutacao,
  useDeleteFrente: mutacao,
}));

vi.mock("@/hooks/useObraTarefas", () => ({
  useObraTarefas: () => ({ data: [] }),
  useCreateObraTarefa: mutacao,
  useUpdateObraTarefa: mutacao,
  useDeleteObraTarefa: mutacao,
}));

vi.mock("@/pages/meu-trabalho/hooks", () => ({
  usePessoasEmpresa: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

function frente(campos: Partial<ObraFrenteRow> = {}): ObraFrenteRow {
  return {
    id: "f1",
    empresa_id: "e1",
    obra_id: "o1",
    nome: "Fundação",
    ordem: 0,
    data_inicio: null,
    data_fim: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...campos,
  } as ObraFrenteRow;
}

describe("ObraCronogramaTab · modal da etapa", () => {
  it("mostra a data salva no campo, não o snapshot de quando abriu", async () => {
    frentes = [frente()];
    const { rerender } = render(<ObraCronogramaTab obraId="o1" projetoId={null} canEdit />);

    await userEvent.click(screen.getByRole("button", { name: /Fundação/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("20/10/2026")).toBeNull();

    // Simula o refetch depois do updateFrente.
    frentes = [frente({ data_inicio: "2026-10-20", updated_at: "2026-10-13T00:00:00Z" })];
    rerender(<ObraCronogramaTab obraId="o1" projetoId={null} canEdit />);

    expect(within(screen.getByRole("dialog")).getByText("20/10/2026")).toBeInTheDocument();
  });

  it("fecha o modal quando a etapa aberta some da lista (excluída)", async () => {
    frentes = [frente()];
    const { rerender } = render(<ObraCronogramaTab obraId="o1" projetoId={null} canEdit />);

    await userEvent.click(screen.getByRole("button", { name: /Fundação/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    frentes = [];
    rerender(<ObraCronogramaTab obraId="o1" projetoId={null} canEdit />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Tarefas sem etapa")).toBeNull();
  });
});
