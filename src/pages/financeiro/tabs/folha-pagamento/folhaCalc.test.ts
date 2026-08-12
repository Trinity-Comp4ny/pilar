import { describe, it, expect } from "vitest";
import { calcularVariavel, calcularTotal, subtotalProjeto, firstPix, parseDetalhe } from "./folhaCalc";

describe("folhaCalc", () => {
  describe("calcularVariavel / calcularTotal", () => {
    it("variável = área × valor/m² e total = fixo + variável", () => {
      const variavel = calcularVariavel(320, 2.5);
      expect(variavel).toBe(800);
      expect(calcularTotal(5000, variavel)).toBe(5800);
    });

    it("degrada com valores ausentes sem virar NaN", () => {
      expect(calcularVariavel(NaN as unknown as number, 2)).toBe(0);
      expect(calcularVariavel(100, undefined as unknown as number)).toBe(0);
      expect(calcularTotal(undefined as unknown as number, 0)).toBe(0);
    });
  });

  describe("subtotalProjeto", () => {
    it("soma dos subtotais por projeto + fixo bate com o total (critério do comprovante)", () => {
      const valorM2 = 2.5;
      const projetos = [
        { nome: "Residencial X", area_m2: 320 },
        { nome: "Comercial Y", area_m2: 80 },
      ];
      const somaSubtotais = projetos.reduce((acc, p) => acc + subtotalProjeto(p, valorM2), 0);
      expect(somaSubtotais).toBe(1000);
      const areaTotal = projetos.reduce((acc, p) => acc + p.area_m2, 0);
      expect(somaSubtotais).toBe(calcularVariavel(areaTotal, valorM2));
      expect(calcularTotal(5000, somaSubtotais)).toBe(6000);
    });
  });

  describe("firstPix", () => {
    it("extrai a primeira chave de array, objeto ou string", () => {
      expect(firstPix(["", "12345"])).toBe("12345");
      expect(firstPix({ cpf: "", email: "a@b.com" })).toBe("a@b.com");
      expect(firstPix("chave-solta")).toBe("chave-solta");
    });

    it("degrada para null quando vazio ou inválido", () => {
      expect(firstPix(null)).toBeNull();
      expect(firstPix([])).toBeNull();
      expect(firstPix({})).toBeNull();
      expect(firstPix(123)).toBeNull();
    });
  });

  describe("parseDetalhe", () => {
    it("normaliza array de projetos do jsonb", () => {
      expect(parseDetalhe([{ nome: "X", area_m2: 100 }])).toEqual([{ nome: "X", area_m2: 100 }]);
      expect(parseDetalhe([{ nome: "Y" }])).toEqual([{ nome: "Y", area_m2: 0 }]);
    });

    it("retorna [] para entrada não-array (folha antiga sem snapshot)", () => {
      expect(parseDetalhe(null)).toEqual([]);
      expect(parseDetalhe(undefined)).toEqual([]);
      expect(parseDetalhe("[]")).toEqual([]);
    });
  });
});
