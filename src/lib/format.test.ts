import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatNumberCompact,
  formatPercent,
} from "./format";

// pt-BR usa espaço não separável entre "R$" e o valor.
const nbsp = " ";

describe("formatCurrency", () => {
  it("padrão: 2 casas", () => {
    expect(formatCurrency(1234.5)).toBe(`R$${nbsp}1.234,50`);
  });

  it("zero e negativo", () => {
    expect(formatCurrency(0)).toBe(`R$${nbsp}0,00`);
    expect(formatCurrency(-987.65)).toBe(`-R$${nbsp}987,65`);
  });

  it("decimals: 0 arredonda explícito (comportamento do antigo formatBRL)", () => {
    expect(formatCurrency(1234.5, { decimals: 0 })).toBe(`R$${nbsp}1.235`);
  });

  it("compact para tiles", () => {
    expect(formatCurrency(1_200_000, { compact: true })).toMatch(/R\$/);
    expect(formatCurrency(1_200_000, { compact: true })).toMatch(/mi/);
  });

  it("valor não finito vira 0 em vez de NaN na tela", () => {
    expect(formatCurrency(NaN)).toBe(`R$${nbsp}0,00`);
    expect(formatCurrency(Infinity)).toBe(`R$${nbsp}0,00`);
  });

  it("acima de 1 milhão mantém separadores", () => {
    expect(formatCurrency(1_234_567.89)).toBe(`R$${nbsp}1.234.567,89`);
  });
});

describe("formatNumber / formatPercent", () => {
  it("número com separador pt-BR", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
  });

  it("percentual com casas controladas", () => {
    expect(formatPercent(12.345)).toBe("12,3%");
    expect(formatPercent(12.345, 0)).toBe("12%");
  });
});

describe("formatDecimal", () => {
  it("número sem símbolo de moeda, 2 casas por padrão", () => {
    expect(formatDecimal(1234.5)).toBe("1.234,50");
  });

  it("casas configuráveis", () => {
    expect(formatDecimal(3.14159, 3)).toBe("3,142");
    expect(formatDecimal(10, 0)).toBe("10");
  });

  it("valor não finito vira 0", () => {
    expect(formatDecimal(NaN)).toBe("0,00");
    expect(formatDecimal(Infinity)).toBe("0,00");
  });
});

describe("formatNumberCompact", () => {
  it("abrevia milhar e milhão", () => {
    expect(formatNumberCompact(1200)).toMatch(/mil/);
    expect(formatNumberCompact(3_400_000)).toMatch(/mi/);
  });

  it("valor não finito vira 0", () => {
    expect(formatNumberCompact(NaN)).toBe("0");
  });
});

describe("formatPercent — bordas", () => {
  it("zero e negativo", () => {
    expect(formatPercent(0)).toBe("0,0%");
    expect(formatPercent(-5.5)).toBe("-5,5%");
  });

  it("valor não finito vira 0%", () => {
    expect(formatPercent(NaN)).toBe("0,0%");
  });
});

describe("formatDateTime", () => {
  it("timestamp ISO completo", () => {
    // horário fixo com offset explícito para o teste não depender do fuso do runner
    const out = formatDateTime("2026-07-25T14:30:00-03:00");
    expect(out).toMatch(/25\/07\/2026/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });

  it("nulo e inválido viram traço", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("abc")).toBe("-");
  });
});
