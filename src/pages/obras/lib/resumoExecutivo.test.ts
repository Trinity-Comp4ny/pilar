import { describe, expect, it } from "vitest";
import { projecaoCusto, situacaoPrazo } from "./resumoExecutivo";

describe("projecaoCusto", () => {
  it("sem orçado não projeta", () => {
    expect(projecaoCusto(0, 500, 50)).toBeNull();
  });

  it("extrapola o gasto pelo avanço", () => {
    expect(projecaoCusto(1000, 600, 50)).toEqual({ projetado: 1200, desvio: 200, extrapolada: true });
  });

  it("avanço baixo demais mantém o orçado", () => {
    expect(projecaoCusto(1000, 400, 5)).toEqual({ projetado: 1000, desvio: 0, extrapolada: false });
  });

  it("obra pronta fecha no realizado", () => {
    expect(projecaoCusto(1000, 900, 100)).toEqual({ projetado: 900, desvio: -100, extrapolada: true });
  });
});

describe("situacaoPrazo", () => {
  const hoje = new Date(2026, 10, 19);

  it("sem data de fim não há leitura", () => {
    expect(situacaoPrazo(null, 10, hoje)).toBeNull();
  });

  it("conta os dias que faltam", () => {
    expect(situacaoPrazo("2026-11-29", 40, hoje)).toEqual({ dias: 10, atrasada: false });
  });

  it("passou do fim com obra incompleta é atraso", () => {
    expect(situacaoPrazo("2026-11-14", 80, hoje)).toEqual({ dias: -5, atrasada: true });
  });

  it("obra pronta fora do prazo não é atraso", () => {
    expect(situacaoPrazo("2026-11-14", 100, hoje)?.atrasada).toBe(false);
  });
});
