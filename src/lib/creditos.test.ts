import { describe, expect, it } from "vitest";
import { creditosParaTokens, formatCreditos, tokensParaCreditos } from "./creditos";

describe("créditos de IA", () => {
  it("converte as cotas dos planos (500k, 2M, 8M) em 100, 400 e 1.600", () => {
    expect(tokensParaCreditos(500_000)).toBe(100);
    expect(tokensParaCreditos(2_000_000)).toBe(400);
    expect(tokensParaCreditos(8_000_000)).toBe(1600);
  });

  it("arredonda para baixo e nunca devolve negativo", () => {
    expect(tokensParaCreditos(4_999)).toBe(0);
    expect(tokensParaCreditos(7_400)).toBe(1);
    expect(tokensParaCreditos(-10_000)).toBe(0);
  });

  it("faz o caminho de volta para gravar em tokens", () => {
    expect(creditosParaTokens(100)).toBe(500_000);
    expect(creditosParaTokens(0)).toBe(0);
  });

  it("formata com singular e plural", () => {
    expect(formatCreditos(5_000)).toBe("1 crédito");
    expect(formatCreditos(8_000_000)).toBe("1.600 créditos");
  });
});

describe("consumo em créditos", () => {
  it("mostra uma casa decimal e não zera uso pequeno", async () => {
    const { formatConsumoCreditos } = await import("./creditos");
    expect(formatConsumoCreditos(2_000)).toBe("0,4");
    expect(formatConsumoCreditos(12_500)).toBe("2,5");
    expect(formatConsumoCreditos(100)).toBe("< 0,1");
    expect(formatConsumoCreditos(0)).toBe("0");
  });
});
