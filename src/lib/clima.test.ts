import { describe, expect, it } from "vitest";
import { climaPorCodigo, corTemperatura, diasComChuva, direcaoVento, nivelUV, type DiaPrevisao } from "./clima";

describe("climaPorCodigo (WMO)", () => {
  it("céu limpo é sol, sem chuva", () => {
    const r = climaPorCodigo(0);
    expect(r.categoria).toBe("sol");
    expect(r.chuva).toBe(false);
    expect(r.rdo).toBe("ensolarado");
  });

  it("chuva forte (65) marca chuva e mapeia para chuva_forte do RDO", () => {
    const r = climaPorCodigo(65);
    expect(r.chuva).toBe(true);
    expect(r.rdo).toBe("chuva_forte");
  });

  it("trovoada (95) é tempestade e chuva forte", () => {
    const r = climaPorCodigo(95);
    expect(r.categoria).toBe("tempestade");
    expect(r.rdo).toBe("chuva_forte");
  });

  it("código nulo/desconhecido não quebra", () => {
    expect(climaPorCodigo(null).label).toBe("Indisponível");
    expect(climaPorCodigo(9999).chuva).toBe(false);
  });
});

describe("diasComChuva", () => {
  const dia = (over: Partial<DiaPrevisao>): DiaPrevisao => ({
    data: "2026-08-01",
    code: 0,
    tempMax: 25,
    tempMin: 15,
    chuvaProb: 0,
    chuvaMm: 0,
    ventoMax: 10,
    uvMax: 5,
    nascer: null,
    ocaso: null,
    ...over,
  });

  it("pega dia por probabilidade alta mesmo com código de sol", () => {
    expect(diasComChuva([dia({ chuvaProb: 70 })])).toHaveLength(1);
  });

  it("pega dia por código de chuva mesmo com probabilidade baixa", () => {
    expect(diasComChuva([dia({ code: 61, chuvaProb: 10 })])).toHaveLength(1);
  });

  it("ignora dia seco", () => {
    expect(diasComChuva([dia({ code: 1, chuvaProb: 20 })])).toHaveLength(0);
  });
});

describe("direcaoVento", () => {
  it("mapeia graus para rosa dos ventos", () => {
    expect(direcaoVento(0)).toBe("N");
    expect(direcaoVento(90)).toBe("L");
    expect(direcaoVento(180)).toBe("S");
    expect(direcaoVento(270)).toBe("O");
  });
  it("vazio para nulo", () => {
    expect(direcaoVento(null)).toBe("");
  });
});

describe("corTemperatura", () => {
  const hue = (s: string) => Number(/hsl\((\d+)/.exec(s)?.[1] ?? "-1");
  it("frio tende ao azul (matiz alto) e quente ao vermelho (matiz baixo)", () => {
    expect(hue(corTemperatura(0))).toBeGreaterThan(hue(corTemperatura(35)));
  });
  it("satura nos extremos sem estourar", () => {
    expect(hue(corTemperatura(-20))).toBeLessThanOrEqual(240);
    expect(hue(corTemperatura(60))).toBeGreaterThanOrEqual(0);
  });
  it("mostra variação real na faixa BR (frio ≠ ameno ≠ quente)", () => {
    const frio = hue(corTemperatura(10));
    const ameno = hue(corTemperatura(22));
    const quente = hue(corTemperatura(30));
    expect(frio).toBeGreaterThan(ameno);
    expect(ameno).toBeGreaterThan(quente);
  });
});

describe("nivelUV", () => {
  it("classifica pela escala OMS", () => {
    expect(nivelUV(1)).toBe("Baixo");
    expect(nivelUV(5)).toBe("Moderado");
    expect(nivelUV(7)).toBe("Alto");
    expect(nivelUV(9)).toBe("Muito alto");
    expect(nivelUV(12)).toBe("Extremo");
  });
});
