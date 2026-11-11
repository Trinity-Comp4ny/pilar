import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CollapsibleKpiSection } from "./CollapsibleKpiSection";

function montar() {
  render(
    <CollapsibleKpiSection storageKey="teste" resumo={<span>9 ativos · 8 em atraso</span>}>
      <div>cards dos indicadores</div>
    </CollapsibleKpiSection>
  );
}

describe("CollapsibleKpiSection", () => {
  beforeEach(() => localStorage.clear());

  it("aberta mostra os cards e esconde o resumo", () => {
    montar();
    expect(screen.getByText("cards dos indicadores")).toBeInTheDocument();
    expect(screen.queryByText("9 ativos · 8 em atraso")).not.toBeInTheDocument();
  });

  it("recolhida troca os cards pelo resumo na mesma linha e lembra a escolha", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Indicadores/ }));
    expect(screen.queryByText("cards dos indicadores")).not.toBeInTheDocument();
    expect(screen.getByText("9 ativos · 8 em atraso")).toBeInTheDocument();
    expect(localStorage.getItem("pilar.collapsible.kpis-teste")).toBe("0");
  });
});
