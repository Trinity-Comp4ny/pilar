import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Intl pt-BR separa "R$" do número com espaço não separável (U+00A0/U+202F).
const norm = (s: string) => s.replace(/\s/g, " ");

import { MoneyInput } from "./MoneyInput";
import { NumberInput } from "./NumberInput";
import { PercentInput } from "./PercentInput";
import { Button } from "@/components/ui/button";
import { parseCurrencyString } from "@/lib/currencyUtils";

function MoneyHarness() {
  const [v, setV] = useState("");
  return <MoneyInput aria-label="valor" value={v} onChange={setV} />;
}

function NumberHarness(props: { allowDecimal?: boolean; min?: number; max?: number }) {
  const [v, setV] = useState("");
  return <NumberInput aria-label="qtd" value={v} onChange={setV} {...props} />;
}

function PercentHarness() {
  const [v, setV] = useState("");
  return <PercentInput aria-label="pct" value={v} onChange={setV} />;
}

// Pai que guarda NÚMERO (não string), como as tabelas de orçamento.
function NumericParentHarness() {
  const [n, setN] = useState(0);
  return (
    <NumberInput
      aria-label="dec"
      allowDecimal
      value={n ? String(n) : ""}
      onChange={(v) => setN(parseFloat(v.replace(",", ".")) || 0)}
    />
  );
}

describe("MoneyInput", () => {
  it("mascara dígitos como centavos", () => {
    render(<MoneyHarness />);
    const input = screen.getByLabelText("valor") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12345" } });
    expect(norm(input.value)).toBe("R$ 123,45");
  });

  it("faz round-trip com parseCurrencyString", () => {
    render(<MoneyHarness />);
    const input = screen.getByLabelText("valor") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "100050" } });
    expect(norm(input.value)).toBe("R$ 1.000,50");
    expect(parseCurrencyString(input.value)).toBe(1000.5);
  });

  it("não é type=number (aceita máscara BR)", () => {
    render(<MoneyHarness />);
    const input = screen.getByLabelText("valor") as HTMLInputElement;
    expect(input.type).not.toBe("number");
    expect(input.inputMode).toBe("numeric");
  });
});

describe("NumberInput", () => {
  it("remove não-dígitos por padrão", () => {
    render(<NumberHarness />);
    const input = screen.getByLabelText("qtd") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3b" } });
    expect(input.value).toBe("123");
  });

  it("clampa no máximo", () => {
    render(<NumberHarness max={60} />);
    const input = screen.getByLabelText("qtd") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "250" } });
    expect(input.value).toBe("60");
  });

  it("permite decimal quando allowDecimal", () => {
    render(<NumberHarness allowDecimal />);
    const input = screen.getByLabelText("qtd") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3,5" } });
    expect(input.value).toBe("3,5");
  });
});

describe("NumberInput com pai numérico", () => {
  it("preserva a vírgula decimal durante a digitação", () => {
    render(<NumericParentHarness />);
    const input = screen.getByLabelText("dec") as HTMLInputElement;
    // O pai normaliza "3," para o número 3 e devolve "3"; o buffer segura a vírgula.
    fireEvent.change(input, { target: { value: "3," } });
    expect(input.value).toBe("3,");
    fireEvent.change(input, { target: { value: "3,5" } });
    expect(input.value).toBe("3,5");
  });

  it("ressincroniza quando o valor externo muda de número (reset)", () => {
    render(<NumericParentHarness />);
    const input = screen.getByLabelText("dec") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3,5" } });
    expect(input.value).toBe("3,5");
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
  });
});

describe("PercentInput", () => {
  it("clampa em 100 e mostra sufixo %", () => {
    render(<PercentHarness />);
    const input = screen.getByLabelText("pct") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "150" } });
    expect(input.value).toBe("100");
    expect(screen.getByText("%")).toBeInTheDocument();
  });
});

describe("Button loading", () => {
  it("desabilita e mostra spinner quando loading", () => {
    render(<Button loading>Salvar</Button>);
    const btn = screen.getByRole("button", { name: /salvar/i });
    expect(btn).toBeDisabled();
    expect(btn.querySelector("svg")).not.toBeNull();
  });

  it("não desabilita quando não está loading", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });
});
