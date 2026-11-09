import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { FinanceFilterProvider } from "../contexts/FinanceFilterContext";

// Seletor de período do header do Financeiro: só aparece nas abas regidas pelo
// período e, na Visão Geral, traz o Diário/Mensal no rodapé.

const filtroProps: { onChange?: (f?: Date, t?: Date) => void; footer?: ReactNode } = {};
vi.mock("@/components/filters/FiltroPeriodo", () => ({
  FiltroPeriodo: (p: { onChange: (f?: Date, t?: Date) => void; footer?: ReactNode }) => {
    filtroProps.onChange = p.onChange;
    filtroProps.footer = p.footer;
    return <div data-testid="filtro-periodo">{p.footer}</div>;
  },
}));

import { PeriodoPopover } from "./PeriodoPopover";
import { useFinanceFilter } from "../hooks/useFinanceFilter";

function setup(activeTab?: string) {
  const ctx = {
    dateFrom: undefined,
    setDateFrom: vi.fn(),
    dateTo: undefined,
    setDateTo: vi.fn(),
    visualizacao: "mes" as const,
    setVisualizacao: vi.fn(),
  };
  render(
    <FinanceFilterProvider value={ctx}>
      <PeriodoPopover activeTab={activeTab} />
    </FinanceFilterProvider>
  );
  return ctx;
}

describe("PeriodoPopover", () => {
  it.each(["lancamentos", "folha", "faturas"])("aba %s tem filtro próprio: não renderiza", (aba) => {
    setup(aba);
    expect(screen.queryByTestId("filtro-periodo")).not.toBeInTheDocument();
  });

  it("na Visão Geral grava o período e oferece Diário/Mensal", () => {
    const ctx = setup("visao-geral");
    const de = new Date(2026, 0, 1);
    const ate = new Date(2026, 0, 31);
    filtroProps.onChange?.(de, ate);
    expect(ctx.setDateFrom).toHaveBeenCalledWith(de);
    expect(ctx.setDateTo).toHaveBeenCalledWith(ate);
    fireEvent.click(screen.getByRole("button", { name: "Diário" }));
    expect(ctx.setVisualizacao).toHaveBeenCalledWith("dia");
  });

  it("sem aba informada também mostra o agrupamento", () => {
    setup();
    expect(screen.getByRole("group", { name: "Agrupar por" })).toBeInTheDocument();
  });

  it("hook fora do provider falha com mensagem clara", () => {
    const Sonda = () => {
      useFinanceFilter();
      return null;
    };
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Sonda />)).toThrow("useFinanceFilter deve ser usado dentro de um FinanceFilterProvider");
    erro.mockRestore();
  });
});
