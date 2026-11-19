import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ObraResumoExecutivo } from "./ObraResumoExecutivo";

const custos = new Map([["o1", { previsto: 10000, realizado: 6000 }]]);
vi.mock("@/pages/obras/hooks/useResumoCustoObras", () => ({ useResumoCustoObras: () => ({ data: custos }) }));

const tarefas = [{ status: "concluida" }, { status: "a_fazer" }];

describe("ObraResumoExecutivo", () => {
  it("mostra avanço, gasto e o custo final projetado", () => {
    render(<ObraResumoExecutivo obraId="o1" fimPrevisto={null} tarefas={tarefas} comCusto />);
    expect(screen.getByText("50%", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByTestId("custo-projetado")).toHaveTextContent("12.000");
    expect(screen.getByText(/acima do orçado/)).toBeInTheDocument();
    expect(screen.getByText("Sem data de fim")).toBeInTheDocument();
  });

  it("sem acesso ao financeiro não mostra os blocos de custo", () => {
    render(<ObraResumoExecutivo obraId="o1" fimPrevisto="2020-01-01" tarefas={tarefas} comCusto={false} />);
    expect(screen.queryByText("Custo final projetado")).not.toBeInTheDocument();
    expect(screen.getByText(/de atraso/)).toBeInTheDocument();
  });

  it("obra sem orçamento avisa em vez de projetar", () => {
    render(<ObraResumoExecutivo obraId="outra" fimPrevisto={null} tarefas={tarefas} comCusto />);
    expect(screen.getAllByText("Sem orçamento definido")).toHaveLength(2);
  });
});
