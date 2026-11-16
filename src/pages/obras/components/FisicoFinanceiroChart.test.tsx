import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useMoneyMask", () => ({
  useMoneyMask: () => (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
}));

import { FisicoFinanceiroChart, TooltipPlanejadoRealizado } from "./FisicoFinanceiroChart";

// O desenho em si é do recharts (sem tamanho no jsdom); aqui vale o que é nosso: o texto do tooltip e o gráfico vazio.

describe("TooltipPlanejadoRealizado", () => {
  it("mostra mês, planejado, realizado e a diferença acima do planejado", () => {
    render(<TooltipPlanejadoRealizado ponto={{ mes: "2026-11", planejadoAcumulado: 250, realizadoAcumulado: 300 }} />);
    expect(screen.getByText("nov/26")).toBeInTheDocument();
    expect(screen.getByText("Planejado: R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText("Realizado: R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("Acima do planejado: R$ 50,00 (+20%)")).toBeInTheDocument();
  });

  it("diferença abaixo do planejado", () => {
    render(<TooltipPlanejadoRealizado ponto={{ mes: "2026-11", planejadoAcumulado: 400, realizadoAcumulado: 300 }} />);
    expect(screen.getByText("Abaixo do planejado: R$ 100,00 (-25%)")).toBeInTheDocument();
  });

  it("mês sem realizado: avisa 'ainda não' e não mostra diferença", () => {
    render(<TooltipPlanejadoRealizado ponto={{ mes: "2026-12", planejadoAcumulado: 300, realizadoAcumulado: null }} />);
    expect(screen.getByText("Realizado: ainda não")).toBeInTheDocument();
    expect(screen.queryByText(/do planejado/)).not.toBeInTheDocument();
  });

  it("planejado zero não mostra percentual", () => {
    render(<TooltipPlanejadoRealizado ponto={{ mes: "2026-09", planejadoAcumulado: 0, realizadoAcumulado: 50 }} />);
    expect(screen.getByText("Acima do planejado: R$ 50,00")).toBeInTheDocument();
  });
});

describe("FisicoFinanceiroChart", () => {
  it("sem pontos não desenha nada", () => {
    const { container } = render(<FisicoFinanceiroChart pontos={[]} mesAtual="2026-11" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("com pontos mostra título e legenda", () => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    render(<FisicoFinanceiroChart pontos={[{ mes: "2026-11", planejadoAcumulado: 10, realizadoAcumulado: 5 }]} mesAtual="2026-11" />);
    expect(screen.getByText("Planejado × realizado")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Legenda" })).toHaveTextContent("PlanejadoRealizado");
  });
});
