import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ObraCurvaS } from "./ObraCurvaS";

let tarefas: unknown[] = [];

vi.mock("@/pages/obras/hooks/useObraTarefas", () => ({ useObraTarefas: () => ({ data: tarefas }) }));
vi.mock("@/pages/obras/hooks/useObraRdo", () => ({ useObraRdos: () => ({ data: [] }) }));
vi.mock("@/pages/obras/hooks/useObraRdoTarefas", () => ({ useObraRdoTarefas: () => ({ data: [] }) }));
vi.mock("@/pages/obras/hooks/useObraOrcamento", () => ({
  useObraOrcamento: () => ({ data: [{ obra_frente_id: "f1", valor_previsto: 1000 }] }),
}));
vi.mock("@/pages/obras/hooks/useObraConta", () => ({
  useObraConta: () => ({ data: [{ tipo: "despesa", data: "2026-06-03", valor: 200, deleted_at: null }] }),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

describe("ObraCurvaS", () => {
  it("sem prazo nas tarefas mostra o empty state", () => {
    tarefas = [{ id: "a", status: "a_fazer", data_inicio: null, prazo: null, updated_at: "2026-06-01T00:00:00Z" }];
    render(<ObraCurvaS obraId="o1" />);
    expect(screen.getByText(/Defina prazo nas tarefas/)).toBeInTheDocument();
  });

  it("com prazo e orçamento desenha o gráfico sem erro", () => {
    tarefas = [
      {
        id: "a",
        obra_frente_id: "f1",
        status: "a_fazer",
        data_inicio: null,
        prazo: "2026-06-10",
        updated_at: "2026-06-01T00:00:00Z",
      },
    ];
    const { container } = render(<ObraCurvaS obraId="o1" />);
    expect(screen.queryByText(/Defina prazo nas tarefas/)).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });
});
