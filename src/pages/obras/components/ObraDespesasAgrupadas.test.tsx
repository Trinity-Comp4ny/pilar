import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ObraDespesasAgrupadas } from "./ObraDespesasAgrupadas";

vi.mock("@/hooks/useMoneyMask", () => ({ useMoneyMask: () => (v: number) => `R$ ${v.toFixed(2)}` }));

const mk = (id: string, valor: number, fornecedor_id: string, descricao: string) => ({
  id,
  tipo: "despesa" as const,
  valor,
  fornecedor_id,
  descricao,
});

const nomes = new Map([
  ["f1", "Concreteira"],
  ["f2", "Ferragens"],
  ["f3", "Tintas"],
  ["f4", "Elétrica"],
]);

describe("ObraDespesasAgrupadas: curva ABC", () => {
  it("classifica por fornecedor e resume as classes", () => {
    const lancs = [
      mk("1", 600, "f1", "Concreto"),
      mk("2", 250, "f2", "Aço"),
      mk("3", 100, "f3", "Tinta"),
      mk("4", 50, "f4", "Fio"),
    ];
    render(<ObraDespesasAgrupadas lancamentos={lancs as never} nomeFornecedor={nomes} />);
    const resumo = screen.getByLabelText("Resumo da curva ABC");
    expect(resumo).toHaveTextContent("A 2 itens");
    expect(resumo).toHaveTextContent("B 1 item");
    expect(resumo).toHaveTextContent("C 1 item");
    expect(screen.getAllByText("A")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Por item" }));
    expect(screen.getByLabelText("Resumo da curva ABC")).toBeInTheDocument();
  });
});
