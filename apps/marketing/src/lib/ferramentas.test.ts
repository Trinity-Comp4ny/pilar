import { describe, expect, it } from "vitest";
import { calcularHonorarios, lerNumero, MODELO_PROPOSTA } from "./ferramentas";

const BASE = {
  custosFixos: 8000,
  folha: 30000,
  proLabore: 20000,
  pessoasTecnicas: 5,
  horasPorMes: 160,
  produtividade: 70,
  margem: 25,
  impostos: 15,
  horasProjeto: 120,
};

describe("calcularHonorarios", () => {
  it("custo da hora sobre as horas produtivas e preço com lucro e imposto por dentro", () => {
    const r = calcularHonorarios(BASE);
    expect(r.custoMensal).toBe(58000);
    expect(r.horasProdutivas).toBe(560);
    expect(r.custoHora).toBeCloseTo(103.571, 2);
    // 103,57 × 1,25 ÷ 0,85: o imposto incide sobre o preço, não sobre o custo.
    expect(r.precoHora).toBeCloseTo(152.31, 2);
    expect(r.precoProjeto).toBeCloseTo(152.31 * 120, 0);
  });

  it("entrada sem hora produtiva ou com imposto de 100% devolve zero, não Infinity", () => {
    expect(calcularHonorarios({ ...BASE, pessoasTecnicas: 0 }).precoHora).toBe(0);
    expect(calcularHonorarios({ ...BASE, impostos: 100 }).precoHora).toBe(0);
  });

  it("ignora valor negativo", () => {
    expect(calcularHonorarios({ ...BASE, custosFixos: -500 }).custoMensal).toBe(50000);
  });
});

describe("lerNumero", () => {
  it.each([
    ["12.500,50", 12500.5],
    ["12500.5", 12500.5],
    ["160", 160],
    ["", 0],
    ["abc", 0],
  ])("%s → %s", (texto, esperado) => {
    expect(lerNumero(texto)).toBe(esperado);
  });
});

describe("modelo de proposta", () => {
  it("tem escopo por disciplina, exclusões, revisões, prazo e parcelas", () => {
    for (const secao of ["ESCOPO POR DISCIPLINA", "NÃO ESTÁ INCLUÍDO", "REVISÕES INCLUÍDAS", "PRAZO", "PAGAMENTO"]) {
      expect(MODELO_PROPOSTA).toContain(secao);
    }
  });
});
