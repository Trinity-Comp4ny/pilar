import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DatePicker } from "./date-picker";
import { mascararData, parseDataDigitada } from "@/lib/data-digitada";

describe("mascararData", () => {
  it("põe as barras sozinha e corta em 8 dígitos", () => {
    expect(mascararData("1")).toBe("1");
    expect(mascararData("150")).toBe("15/0");
    expect(mascararData("15032026")).toBe("15/03/2026");
    expect(mascararData("15/03/20261")).toBe("15/03/2026");
    expect(mascararData("ab15c")).toBe("15");
  });
});

describe("parseDataDigitada", () => {
  it("aceita dd/mm/aaaa e dd/mm/aa", () => {
    expect(parseDataDigitada("15/03/2026")?.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(parseDataDigitada("15/03/26")?.getFullYear()).toBe(2026);
  });

  it("só dia e mês usa o ano corrente", () => {
    expect(
      parseDataDigitada("15/03", new Date(2027, 0, 1))
        ?.toISOString()
        .slice(0, 10)
    ).toBe("2027-03-15");
  });

  it("recusa data impossível ou incompleta", () => {
    expect(parseDataDigitada("31/02/2026")).toBeUndefined();
    expect(parseDataDigitada("10/13/2026")).toBeUndefined();
    expect(parseDataDigitada("10/03/2")).toBeUndefined();
  });
});

describe("DatePicker", () => {
  it("mostra o valor em dd/mm/aaaa", () => {
    render(<DatePicker value="2026-03-15" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("15/03/2026");
  });

  it("digitar uma data válida e sair do campo grava em ISO", () => {
    const onChange = vi.fn();
    render(<DatePicker onChange={onChange} />);
    const campo = screen.getByRole("textbox");
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "05112026" } });
    expect(campo).toHaveValue("05/11/2026");
    fireEvent.blur(campo);
    expect(onChange).toHaveBeenCalledWith("2026-11-05");
  });

  it("Enter confirma a data digitada", () => {
    const onChange = vi.fn();
    render(<DatePicker onChange={onChange} />);
    const campo = screen.getByRole("textbox");
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "01/01/2027" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("2027-01-01");
  });

  it("data inválida ou fora do limite volta ao valor anterior", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-03-15" minDate="2026-03-01" onChange={onChange} />);
    const campo = screen.getByRole("textbox");
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "31/02/2026" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("15/03/2026");
    expect(screen.getByRole("alert")).toHaveTextContent('"31/02/2026" não é uma data válida. Use dia/mês/ano.');
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "10/02/2026" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("15/03/2026");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A data precisa ser a partir de 01/03/2026.");
    expect(campo).toHaveAttribute("aria-invalid", "true");
  });

  it("sair do campo sem mudar nada não avisa nem grava", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-03-15" onChange={onChange} />);
    const campo = screen.getByRole("textbox");
    fireEvent.focus(campo);
    fireEvent.blur(campo);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o atalho Hoje grava a data de hoje", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 15, 0));
    const onChange = vi.fn();
    render(<DatePicker onChange={onChange} />);
    fireEvent.click(screen.getByRole("textbox"));
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-10");
    vi.useRealTimers();
  });

  it("sem Hoje quando hoje está fora do limite", () => {
    render(<DatePicker onChange={vi.fn()} maxDate="2020-01-01" />);
    fireEvent.click(screen.getByRole("textbox"));
    expect(screen.queryByRole("button", { name: "Hoje" })).not.toBeInTheDocument();
  });

  it("apagar o texto limpa a data", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-03-15" onChange={onChange} />);
    const campo = screen.getByRole("textbox");
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("clicar no campo abre o calendário com mês e ano em lista", () => {
    render(<DatePicker value="2026-03-15" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("textbox"));
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2);
    // Março/2026 cabe em 5 semanas, mas o grid tem sempre 6: a altura não muda ao trocar de mês.
    expect(screen.getAllByRole("row").length).toBe(6);
  });
});
