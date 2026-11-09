import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ViewSwitcher } from "./ViewSwitcher";

const OPCOES = [
  { value: "lista", label: "Lista" },
  { value: "quadro", label: "Quadro" },
] as const;

describe("ViewSwitcher", () => {
  it("só a visão atual fica pressionada", () => {
    render(<ViewSwitcher options={[...OPCOES]} value="quadro" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Quadro" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "false");
  });

  it("ativo usa fundo verde com texto ink", () => {
    render(<ViewSwitcher options={[...OPCOES]} value="lista" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Lista" })).toHaveClass("bg-brand", "text-ink");
  });

  it("clique devolve o valor da visão", () => {
    const onChange = vi.fn();
    render(<ViewSwitcher options={[...OPCOES]} value="lista" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Quadro" }));
    expect(onChange).toHaveBeenCalledWith("quadro");
  });
});
