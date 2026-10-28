import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CronogramaColunaProjetos, type LinhaColunaProjeto } from "./CronogramaColunaProjetos";
import { CronogramaMeusToggle, useFiltroMeusProjetos } from "./CronogramaMeusToggle";
import { type Projeto } from "@/types/projetos";

// SPEC 143 (BEZ-350): selo de prioridade, alça de arraste só para quem pode, e o modo
// "Meus projetos" mostrando só as disciplinas da pessoa.

vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: () => ({
    isLoading: false,
    data: [
      { id: "d1", nome: "Estrutural", status: "Em Andamento", responsaveis: [{ id: "ju", nome: "Juliana" }] },
      { id: "d2", nome: "Hidrossanitário", status: "Em Andamento", responsaveis: [{ id: "ta", nome: "Thiago" }] },
      { id: "d3", nome: "Elétrico", status: "Em Andamento", responsaveis: [{ id: "ta", nome: "Thiago" }] },
    ],
  }),
}));

const linha = (id: string, ordem: number | null): LinhaColunaProjeto => ({
  projeto: {
    id,
    nome: `Projeto ${id}`,
    status: "Em andamento",
    ordem_prioridade: ordem,
    disciplinas: [],
  } as unknown as Projeto,
  atrasado: false,
  barClass: "bg-status-progress",
});

const base = {
  isMobile: false,
  isExpanded: () => false,
  onToggleExpand: vi.fn(),
  onOpen: vi.fn(),
  onReordenar: vi.fn(),
  outrasAbertas: new Set<string>(),
  onToggleOutras: vi.fn(),
};

describe("CronogramaColunaProjetos", () => {
  it("mostra o selo #n só nos projetos com ordem", () => {
    render(<CronogramaColunaProjetos {...base} rows={[linha("a", 1), linha("b", null)]} podeReordenar={false} />);

    expect(screen.getByLabelText("Prioridade 1")).toHaveTextContent("#1");
    expect(screen.queryByLabelText(/Prioridade 2/)).not.toBeInTheDocument();
  });

  it("a alça de arraste só existe para quem pode reordenar", () => {
    const { rerender } = render(<CronogramaColunaProjetos {...base} rows={[linha("a", 1)]} podeReordenar={false} />);
    expect(screen.queryByLabelText("Arrastar para reordenar Projeto a")).not.toBeInTheDocument();

    rerender(<CronogramaColunaProjetos {...base} rows={[linha("a", 1)]} podeReordenar />);
    expect(screen.getByLabelText("Arrastar para reordenar Projeto a")).toBeInTheDocument();
  });

  it("em Meus projetos mostra só as disciplinas da pessoa e abre as outras pelo +N", () => {
    const onToggleOutras = vi.fn();
    render(
      <CronogramaColunaProjetos
        {...base}
        rows={[linha("a", 1)]}
        podeReordenar={false}
        isExpanded={() => true}
        pessoaId="ju"
        onToggleOutras={onToggleOutras}
      />
    );

    expect(screen.getByText("Estrutural")).toBeInTheDocument();
    expect(screen.queryByText("Hidrossanitário")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+2 disciplinas de outras pessoas" }));
    expect(onToggleOutras).toHaveBeenCalledWith("a");
  });

  it("com as outras abertas lista todas e oferece ocultar", () => {
    render(
      <CronogramaColunaProjetos
        {...base}
        rows={[linha("a", 1)]}
        podeReordenar={false}
        isExpanded={() => true}
        pessoaId="ju"
        outrasAbertas={new Set(["a"])}
      />
    );

    expect(screen.getByText("Hidrossanitário")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar disciplinas de outras pessoas" })).toBeInTheDocument();
  });
});

describe("CronogramaMeusToggle", () => {
  function Harness() {
    const [meus, setMeus] = useFiltroMeusProjetos();
    return <CronogramaMeusToggle value={meus} onChange={setMeus} />;
  }

  it("liga e desliga Meus projetos", () => {
    render(
      <MemoryRouter initialEntries={["/projetos/cronograma?meus=1"]}>
        <Harness />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Meus projetos" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Todos os projetos" }));
    expect(screen.getByRole("button", { name: "Todos os projetos" })).toHaveAttribute("aria-pressed", "true");
  });
});
