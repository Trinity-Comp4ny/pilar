import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SectionTabs, type SectionTab } from "./SectionTabs";

const TABS: SectionTab[] = [
  { id: "a", label: "Visão geral" },
  { id: "b", label: "Lançamentos", badge: 3 },
  { id: "c", label: "Em breve", disabled: true },
  { id: "d", label: "Relatórios" },
];

describe("SectionTabs", () => {
  it("marca só a aba ativa e deixa só ela no tab order", () => {
    render(<SectionTabs tabs={TABS} value="b" onValueChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Lançamentos/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Lançamentos/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("tabindex", "-1");
  });

  it("mostra o badge de contagem", () => {
    render(<SectionTabs tabs={TABS} value="a" onValueChange={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("clique troca de aba", () => {
    const onChange = vi.fn();
    render(<SectionTabs tabs={TABS} value="a" onValueChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Relatórios" }));
    expect(onChange).toHaveBeenCalledWith("d");
  });

  it("seta direita pula a aba desabilitada", () => {
    const onChange = vi.fn();
    render(<SectionTabs tabs={TABS} value="b" onValueChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Lançamentos/ }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("d");
  });

  it("seta esquerda na primeira aba volta para a última habilitada", () => {
    const onChange = vi.fn();
    render(<SectionTabs tabs={TABS} value="a" onValueChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Visão geral" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("d");
  });

  it("Home e End vão para a primeira e a última aba habilitadas", () => {
    const onChange = vi.fn();
    render(<SectionTabs tabs={TABS} value="b" onValueChange={onChange} />);
    const ativa = screen.getByRole("tab", { name: /Lançamentos/ });
    fireEvent.keyDown(ativa, { key: "Home" });
    fireEvent.keyDown(ativa, { key: "End" });
    expect(onChange).toHaveBeenNthCalledWith(1, "a");
    expect(onChange).toHaveBeenNthCalledWith(2, "d");
  });

  it("aba desabilitada não dispara clique", () => {
    const onChange = vi.fn();
    render(<SectionTabs tabs={TABS} value="a" onValueChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Em breve" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
