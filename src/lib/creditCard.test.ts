import { describe, it, expect } from "vitest";
import { detectCardBrand, formatCardNumber, formatExpiry, luhnValid, validateCreditCard } from "./creditCard";

describe("detectCardBrand", () => {
  it("reconhece visa, mastercard, amex e elo pelo prefixo", () => {
    expect(detectCardBrand("4111111111111111")).toBe("visa");
    expect(detectCardBrand("5500000000000004")).toBe("mastercard");
    expect(detectCardBrand("340000000000009")).toBe("amex");
    expect(detectCardBrand("6362970000457013")).toBe("elo");
  });

  it("prefixo desconhecido devolve null", () => {
    expect(detectCardBrand("1234567890123456")).toBeNull();
  });
});

describe("formatCardNumber / formatExpiry", () => {
  it("agrupa o número em blocos de 4 e trunca em 16 dígitos", () => {
    expect(formatCardNumber("4111111111111111999")).toBe("4111 1111 1111 1111");
  });

  it("insere a barra depois do 2º dígito da validade", () => {
    expect(formatExpiry("1230")).toBe("12/30");
    expect(formatExpiry("1")).toBe("1");
  });
});

describe("luhnValid", () => {
  it("aceita número de teste válido (visa)", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(luhnValid("4111111111111112")).toBe(false);
  });
});

describe("validateCreditCard", () => {
  it("cartão válido com validade futura passa", () => {
    const result = validateCreditCard("4111 1111 1111 1111", "12/30");
    expect(result.ok).toBe(true);
  });

  it("número com Luhn inválido é recusado", () => {
    const result = validateCreditCard("4111 1111 1111 1112", "12/30");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/número/i);
  });

  it("validade vencida é recusada mesmo com número válido", () => {
    const result = validateCreditCard("4111 1111 1111 1111", "01/20");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/vencido/i);
  });

  it("mês inválido (13) é recusado", () => {
    const result = validateCreditCard("4111 1111 1111 1111", "13/30");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/validade/i);
  });
});
