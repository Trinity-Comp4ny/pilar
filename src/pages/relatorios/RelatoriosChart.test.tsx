import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

// Gráfico mensal dos relatórios: barras conforme o tipo (receitas, despesas
// ou financeiro com as duas + legenda).

vi.mock("recharts", async (orig) => {
  const real = await orig<typeof import("recharts")>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, { width: 600, height: 220 })
        : null,
  };
});

import RelatoriosChart from "./RelatoriosChart";

const dados = [
  { mes: "Set", Receitas: 1000, Despesas: 400 },
  { mes: "Out", Receitas: 2000, Despesas: 2500 },
];

const series = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".recharts-bar")).map((g) => g.getAttribute("class"));

describe("RelatoriosChart", () => {
  it("financeiro mostra receitas e despesas com legenda", () => {
    const { container } = render(<RelatoriosChart chartData={dados} tipoRelatorio="financeiro" />);
    expect(screen.getByText("Evolução mensal")).toBeInTheDocument();
    expect(series(container)).toHaveLength(2);
    expect(container.querySelector(".recharts-legend-wrapper")).not.toBeNull();
  });

  it.each(["receitas", "despesas"])("relatório de %s mostra só uma série, sem legenda", (tipo) => {
    const { container } = render(<RelatoriosChart chartData={dados} tipoRelatorio={tipo} />);
    expect(series(container)).toHaveLength(1);
    expect(container.querySelector(".recharts-legend-wrapper")).toBeNull();
  });
});
