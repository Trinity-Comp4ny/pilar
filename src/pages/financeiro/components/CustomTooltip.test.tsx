import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValoresOcultosProvider } from "@/contexts/ValoresOcultosContext";
import { CustomTooltip } from "./CustomTooltip";

// Tooltip dos gráficos do Financeiro: moeda com 2 casas e respeito a "ocultar valores".

describe("CustomTooltip", () => {
  it("inativo ou sem payload não renderiza", () => {
    const { container, rerender } = render(<CustomTooltip active={false} payload={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CustomTooltip active payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lista as séries com valor em reais", () => {
    render(
      <CustomTooltip
        active
        label="Out"
        payload={[
          { color: "#0a0", name: "Receitas", value: 1234.5 },
          { color: "#a00", name: "Despesas", value: "n/d" },
        ]}
      />
    );
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.getByText("Receitas:").nextElementSibling?.textContent).toMatch(/^R\$\s?1\.234,50$/);
    expect(screen.getByText("Despesas:").nextElementSibling).toHaveTextContent("R$ n/d");
  });

  it("com valores ocultos não revela o número", () => {
    localStorage.setItem("pilar:valores-ocultos", "1");
    try {
      render(
        <ValoresOcultosProvider>
          <CustomTooltip active label="Out" payload={[{ color: "#0a0", name: "Receitas", value: 1234.5 }]} />
        </ValoresOcultosProvider>
      );
      expect(screen.getByText("Receitas:").nextElementSibling).toHaveTextContent("R$ ••••");
    } finally {
      localStorage.removeItem("pilar:valores-ocultos");
    }
  });
});
