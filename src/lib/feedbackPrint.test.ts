import { describe, expect, it } from "vitest";
import { ajustarTamanho, espessuraTraco, montarContexto, retanguloEntre } from "./feedbackPrint";

describe("ajustarTamanho", () => {
  it("mantém imagem que já cabe", () => {
    expect(ajustarTamanho(1440, 900)).toEqual({ largura: 1440, altura: 900 });
  });

  it("reduz pelo lado maior mantendo a proporção", () => {
    expect(ajustarTamanho(3840, 2160)).toEqual({ largura: 2400, altura: 1350 });
    expect(ajustarTamanho(1170, 4800)).toEqual({ largura: 585, altura: 2400 });
  });
});

describe("retanguloEntre", () => {
  it("normaliza quando o arrasto vai pra cima e pra esquerda", () => {
    expect(retanguloEntre({ x: 100, y: 80 }, { x: 40, y: 20 })).toEqual({ x: 40, y: 20, largura: 60, altura: 60 });
  });
});

describe("espessuraTraco", () => {
  it("tem piso de 3 px e cresce com o print", () => {
    expect(espessuraTraco(400)).toBe(3);
    expect(espessuraTraco(2400)).toBe(8);
  });
});

describe("montarContexto", () => {
  it("guarda só o pathname, sem query string, e corta o user agent", () => {
    const ctx = montarContexto(
      { pathname: "/projetos/abc" },
      { innerWidth: 1280, innerHeight: 720 },
      "x".repeat(500),
      "r1"
    );
    expect(ctx).toEqual({ rota: "/projetos/abc", janela: "1280x720", navegador: "x".repeat(300), release: "r1" });
  });
});
