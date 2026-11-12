import { describe, it, expect } from "vitest";
import {
  calcularVariavel,
  calcularTotal,
  calcularComissao,
  subtotalProjeto,
  firstPix,
  parseDetalhe,
  folhaItemDeRegistro,
  areaDeProjetosUnicos,
} from "./folhaCalc";

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

    it("lê o formato do cadastro de pessoas ([{ chave, tipo }])", () => {
      expect(firstPix([{ chave: "joao@escritorio.com.br", tipo: "email" }])).toBe("joao@escritorio.com.br");
      expect(
        firstPix([
          { chave: "", tipo: "cpf" },
          { chave: "11999990000", tipo: "celular" },
        ])
      ).toBe("11999990000");
      expect(firstPix([{ tipo: "cpf" }])).toBeNull();
    });

    it("folha com área fracionada e valor/m² com centavos", () => {
      expect(calcularVariavel(123.45, 3.1)).toBeCloseTo(382.695, 10);
      expect(calcularTotal(0, 0)).toBe(0);
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

  describe("percentual sobre o valor do projeto", () => {
    it("montador: 10% de um armário de R$ 10 mil = R$ 1.000", () => {
      expect(calcularComissao(10000, 10)).toBe(1000);
      expect(calcularVariavel(0, 0, 10000, 10)).toBe(1000);
    });

    it("soma com o m²: 120 m² × 5 + 2,5% de 40 mil = 1600", () => {
      expect(calcularVariavel(120, 5, 40000, 2.5)).toBe(1600);
      expect(subtotalProjeto({ nome: "Casa", area_m2: 120, valor_base: 40000 }, 5, 2.5)).toBe(1600);
    });

    it("sem valor de projeto ou sem percentual, não soma nada", () => {
      expect(calcularVariavel(100, 2, undefined, 10)).toBe(200);
      expect(subtotalProjeto({ nome: "Antigo", area_m2: 100 }, 2, 10)).toBe(200);
      expect(calcularComissao(NaN, 10)).toBe(0);
    });

    it("parseDetalhe preserva o valor base e tolera snapshot antigo", () => {
      expect(
        parseDetalhe([
          { nome: "A", area_m2: 1, valor_base: "500" },
          { nome: "B", area_m2: 2 },
        ])
      ).toEqual([
        { nome: "A", area_m2: 1, valor_base: 500 },
        { nome: "B", area_m2: 2 },
      ]);
    });

    it("folhaItemDeRegistro lê o snapshot da folha fechada, inclusive sem as colunas novas", () => {
      const base = {
        id: "f1",
        pessoa_id: "p1",
        salario_fixo: 0,
        valor_m2: 0,
        total_area_projetada: 0,
        adicional_variavel: null,
        total_receber: null,
        status: "pendente",
        data_pagamento: null,
      };
      const novo = folhaItemDeRegistro({ ...base, percentual_producao: 10, total_valor_base: 10000 }, { nome: "M" });
      expect(novo).toMatchObject({ p_percentual: 10, soma_valor_base: 10000, v_variavel: 1000, v_total: 1000 });
      const antigo = folhaItemDeRegistro({ ...base, salario_fixo: 2000 });
      expect(antigo).toMatchObject({ p_nome: "Desconhecido", p_percentual: 0, v_variavel: 0, v_total: 2000 });
    });
  });

  describe("regra por conclusão", () => {
    it("parseDetalhe guarda projeto_id e concluido_em quando vêm do banco", () => {
      expect(
        parseDetalhe([{ projeto_id: "p1", nome: "Casa", area_m2: 200, valor_base: 20000, concluido_em: "2026-11-05" }])
      ).toEqual([{ projeto_id: "p1", nome: "Casa", area_m2: 200, valor_base: 20000, concluido_em: "2026-11-05" }]);
      expect(parseDetalhe([{ nome: "Torre", area_m2: 100 }])).toEqual([{ nome: "Torre", area_m2: 100 }]);
    });

    it("área total conta cada projeto uma vez, mesmo com várias pessoas nele", () => {
      const casa = { projeto_id: "p1", nome: "Casa", area_m2: 200 };
      const torre = { projeto_id: "p2", nome: "Torre", area_m2: 150 };
      expect(
        areaDeProjetosUnicos([
          { detalhe_projetos: [casa, torre] },
          { detalhe_projetos: [casa] },
          { detalhe_projetos: [] },
        ])
      ).toBe(350);
    });

    it("folha antiga sem projeto_id deduplica pelo nome", () => {
      expect(
        areaDeProjetosUnicos([
          { detalhe_projetos: [{ nome: "Torre", area_m2: 100 }] },
          {
            detalhe_projetos: [
              { nome: "Torre", area_m2: 100 },
              { nome: "Casa", area_m2: 50 },
            ],
          },
        ])
      ).toBe(150);
    });
  });
});
