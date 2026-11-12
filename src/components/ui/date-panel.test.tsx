import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DatePanel } from "./date-panel";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("DatePanel", () => {
  it("digitar e Enter escolhe a data", () => {
    const onSelect = vi.fn();
    render(<DatePanel onSelect={onSelect} />);
    const campo = screen.getByRole("textbox", { name: "Digitar data" });
    fireEvent.change(campo, { target: { value: "20122026" } });
    expect(campo).toHaveValue("20/12/2026");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(iso(onSelect.mock.calls[0][0])).toBe("2026-12-20");
  });

  it("data inválida avisa no próprio painel e não escolhe", () => {
    const onSelect = vi.fn();
    render(<DatePanel onSelect={onSelect} />);
    const campo = screen.getByRole("textbox", { name: "Digitar data" });
    fireEvent.change(campo, { target: { value: "31022026" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Data inválida. Use dia/mês/ano.")).toBeInTheDocument();
  });

  it("atalhos de prazo", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 15, 0));
    const onSelect = vi.fn();
    render(<DatePanel onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Amanhã" }));
    fireEvent.click(screen.getByRole("button", { name: "Em 1 semana" }));
    expect(onSelect.mock.calls.map(([d]) => iso(d))).toEqual(["2026-11-11", "2026-11-17"]);
    vi.useRealTimers();
  });

  it("Limpar só aparece com onClear", () => {
    const onClear = vi.fn();
    const { rerender } = render(<DatePanel onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Limpar" })).not.toBeInTheDocument();
    rerender(<DatePanel onSelect={vi.fn()} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onClear).toHaveBeenCalled();
  });
});
