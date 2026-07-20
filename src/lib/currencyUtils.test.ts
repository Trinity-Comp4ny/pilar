import { describe, it, expect } from "vitest";
import { parseCurrencyString, formatCurrencyInput, removeNonNumeric, formatCurrency, formatValorToInput } from "./currencyUtils";

describe("parseCurrencyString", () => {
  it("parses formatted Brazilian currency", () => {
    expect(parseCurrencyString("R$ 1.500,00")).toBe(1500);
    expect(parseCurrencyString("R$ 0,50")).toBe(0.5);
    expect(parseCurrencyString("R$ 10,99")).toBe(10.99);
  });

  it("parses value without R$ symbol", () => {
    expect(parseCurrencyString("1.500,00")).toBe(1500);
    expect(parseCurrencyString("100,50")).toBe(100.5);
  });

  it("parses value without comma as cents", () => {
    expect(parseCurrencyString("1500")).toBe(15);
    expect(parseCurrencyString("100")).toBe(1);
  });

  it("returns 0 for empty or invalid input", () => {
    expect(parseCurrencyString("")).toBe(0);
    expect(parseCurrencyString("abc")).toBe(0);
  });
});

describe("formatCurrencyInput", () => {
  it("formats digits as Brazilian currency", () => {
    expect(formatCurrencyInput("150000")).toContain("1.500,00");
    expect(formatCurrencyInput("50")).toContain("0,50");
    expect(formatCurrencyInput("1099")).toContain("10,99");
  });

  it("returns R$ 0,00 for empty input", () => {
    expect(formatCurrencyInput("")).toContain("0,00");
    expect(formatCurrencyInput("abc")).toContain("0,00");
  });

  it("strips non-numeric characters before formatting", () => {
    expect(formatCurrencyInput("R$ 1.500,00")).toContain("1.500,00");
  });
});

describe("removeNonNumeric", () => {
  it("removes all non-digit characters", () => {
    expect(removeNonNumeric("R$ 1.500,00")).toBe("150000");
    expect(removeNonNumeric("abc123def")).toBe("123");
    expect(removeNonNumeric("")).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats number as Brazilian currency", () => {
    expect(formatCurrency(1500)).toContain("1.500");
    expect(formatCurrency(0)).toContain("0,00");
    expect(formatCurrency(10.5)).toContain("10,50");
  });
});

describe("parseCurrencyString — edge cases", () => {
  it("sinal negativo é ignorado (stripped como não-numérico) — retorna positivo", () => {
    // O parser remove não-numéricos: "-100" vira "100" → 100/100 = 1
    expect(parseCurrencyString("-100")).toBe(1);
  });

  it("parseia valor com 1 casa decimal", () => {
    expect(parseCurrencyString("10,5")).toBe(10.5);
  });

  it("parseia valor com separadores de milhar e decimal", () => {
    expect(parseCurrencyString("1.234.567,89")).toBe(1234567.89);
  });

  it("retorna 0 para string só com símbolo", () => {
    expect(parseCurrencyString("R$")).toBe(0);
  });

  it("parseia zero formatado", () => {
    expect(parseCurrencyString("R$ 0,00")).toBe(0);
  });

  it("parseia formato US colado (vírgula=milhar, ponto=decimal) — ACH-FIN-01", () => {
    expect(parseCurrencyString("1,000.50")).toBe(1000.5);
    expect(parseCurrencyString("R$ 2,500.99")).toBe(2500.99);
  });

  it("parseia valor alto sem perder precisão", () => {
    expect(parseCurrencyString("R$ 999.999,99")).toBe(999999.99);
  });
});

describe("formatValorToInput", () => {
  it("formata número como moeda BRL", () => {
    expect(formatValorToInput(1500)).toContain("1.500");
    expect(formatValorToInput(0)).toContain("0,00");
    expect(formatValorToInput(1500)).toContain("R");
  });

  it("formata centavos corretamente", () => {
    expect(formatValorToInput(0.01)).toContain("0,01");
    expect(formatValorToInput(1.5)).toContain("1,50");
  });
});

describe("formatCurrencyInput — edge cases", () => {
  it("retorna R$ 0,00 para entrada nula-like", () => {
    expect(formatCurrencyInput("")).toContain("0,00");
    expect(formatCurrencyInput("0")).toContain("0,00");
    expect(formatCurrencyInput("00")).toContain("0,00");
  });

  it("formata valor grande corretamente", () => {
    expect(formatCurrencyInput("99999999")).toContain("999.999,99");
  });

  it("ignora múltiplos zeros à esquerda", () => {
    const result = formatCurrencyInput("001");
    expect(result).toContain("0,01");
  });
});
