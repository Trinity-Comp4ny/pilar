import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisciplinasTableView } from "./DisciplinasTableView";
import type { DisciplinaResponsavel, ProjetoDisciplinaDB } from "@/types/projetos";

// Badge de revisão por disciplina (spec 093). O contador vem de fora, agregado no
// nível da aba, e é casado por índice com dbDisciplinas: é exatamente esse casamento
// que o teste protege, porque um badge no lugar errado é pior que badge nenhum.

const disciplinasLegacy = [
  { disciplina: "Estrutural", status: "Em Andamento", prioridade: "Media", responsavel_ids: [] },
  { disciplina: "Elétrica", status: "Em Andamento", prioridade: "Media", responsavel_ids: [] },
] as unknown as DisciplinaResponsavel[];

const dbDisciplinas = [
  { id: "disc-1", projeto_id: "p1", nome: "Estrutural", status: "Em Andamento" },
  { id: "disc-2", projeto_id: "p1", nome: "Elétrica", status: "Em Andamento" },
] as unknown as ProjetoDisciplinaDB[];

const baseProps = {
  canEdit: false,
  disciplinasLegacy,
  dbDisciplinas,
  disciplinasCatalog: [],
  pessoas: [],
  applyDiscStatusChange: vi.fn(),
  handleRemoveDisc: vi.fn(),
  handleAddDisc: vi.fn(),
  handleSaveDiscChanges: vi.fn(),
  handleAddResponsavel: vi.fn(),
  handleRemoveResponsavel: vi.fn(),
};

describe("DisciplinasTableView, badge de revisões", () => {
  it("sem revisão registrada não mostra badge", () => {
    render(<DisciplinasTableView {...baseProps} />);
    expect(screen.queryByTitle(/revis/i)).not.toBeInTheDocument();
  });

  it("mostra o total na disciplina certa e marca a que tem revisão em aberto", () => {
    render(
      <DisciplinasTableView
        {...baseProps}
        revisoesCounts={{
          "disc-1": { total: 3, abertas: 1 },
          "disc-2": { total: 1, abertas: 0 },
        }}
      />
    );

    const aberta = screen.getByTitle("Revisão em aberto nesta disciplina");
    expect(aberta).toHaveTextContent("3");

    const fechada = screen.getByTitle("Revisões já concluídas nesta disciplina");
    expect(fechada).toHaveTextContent("1");
  });

  it("contador de uma disciplina não vaza para a outra", () => {
    render(<DisciplinasTableView {...baseProps} revisoesCounts={{ "disc-2": { total: 2, abertas: 0 } }} />);
    const badges = screen.getAllByTitle(/revis/i);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("2");
  });
});
