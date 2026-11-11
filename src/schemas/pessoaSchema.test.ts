import { describe, expect, it } from "vitest";
import { parsePercentual } from "./pessoaSchema";

describe("parsePercentual", () => {
  it("aceita vírgula, ponto e o símbolo de %", () => {
    expect(parsePercentual("10")).toBe(10);
    expect(parsePercentual("2,5")).toBe(2.5);
    expect(parsePercentual(" 2.5 % ")).toBe(2.5);
    expect(parsePercentual("10%%")).toBe(10);
  });

  it("vazio ou inválido vira null", () => {
    expect(parsePercentual("")).toBeNull();
    expect(parsePercentual(undefined)).toBeNull();
    expect(parsePercentual("abc")).toBeNull();
    expect(parsePercentual("1,2,3")).toBeNull();
  });
});
