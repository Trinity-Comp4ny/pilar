import { describe, it, expect } from "vitest";
import { parseCurrencyString, formatCurrencyInput, removeNonNumeric, formatCurrency } from "./currencyUtils";

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
