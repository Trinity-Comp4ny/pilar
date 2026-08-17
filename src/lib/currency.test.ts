import { describe, expect, it } from "vitest";
import { formatBRL } from "./currency";

// pt-BR usa espaço não separável entre "R$" e o valor.
const nbsp = " ";

describe("formatBRL (legado, ADR 0008)", () => {
  it("formata inteiro sem casas decimais (mínimo 0)", () => {
    expect(formatBRL(1500)).toBe(`R$${nbsp}1.500`);
  });

  it("preserva casas decimais quando o valor tem centavos (máximo 2)", () => {
    // Comportamento LEGADO documentado: mínimo 0 e máximo 2 casas.
    expect(formatBRL(1234.5)).toBe(`R$${nbsp}1.234,5`);
    expect(formatBRL(10.99)).toBe(`R$${nbsp}10,99`);
  });

  it("zero vira R$ 0 (sem decimais forçados)", () => {
    expect(formatBRL(0)).toBe(`R$${nbsp}0`);
  });

  it("valor negativo mantém o sinal", () => {
    expect(formatBRL(-987.65)).toBe(`-R$${nbsp}987,65`);
  });

  it("separadores de milhar acima de 1 milhão", () => {
    expect(formatBRL(1_234_567)).toBe(`R$${nbsp}1.234.567`);
  });

  it("arredonda a terceira casa para no máximo duas", () => {
    // 10,999 -> 11 (arredonda), diferente de truncar
    expect(formatBRL(10.999)).toBe(`R$${nbsp}11`);
  });
});
