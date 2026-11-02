import { describe, expect, it } from "vitest";
import { calcularOrcamento, disciplinaAberta, lerHoras, textoComunicado } from "./plano";

describe("lerHoras", () => {
  it("aceita vírgula e ponto decimal", () => {
    expect(lerHoras("12,5")).toBe(12.5);
    expect(lerHoras("12.5")).toBe(12.5);
    expect(lerHoras("80")).toBe(80);
  });

  it("vazio, negativo e texto viram zero", () => {
    expect(lerHoras("")).toBe(0);
    expect(lerHoras("-4")).toBe(0);
    expect(lerHoras("abc")).toBe(0);
  });
});

describe("calcularOrcamento", () => {
  it("soma horas e custo e calcula a margem sobre o contrato", () => {
    const r = calcularOrcamento(
      [
        { horas: 80, custoHora: 120 },
        { horas: 100, custoHora: 150 },
        { horas: 60, custoHora: 110 },
        { horas: 50, custoHora: 110 },
      ],
      50000
    );
    expect(r).toEqual({ horas: 290, custo: 36700, margemPct: 26.6, acimaDoContrato: false });
  });

  it("ignora linha sem horas ou sem custo por hora", () => {
    const r = calcularOrcamento(
      [
        { horas: 10, custoHora: 100 },
        { horas: 0, custoHora: 500 },
        { horas: 20, custoHora: 0 },
      ],
      null
    );
    expect(r.horas).toBe(10);
    expect(r.custo).toBe(1000);
  });

  it("sem contrato não há margem; contrato menor que o custo marca acima do contrato", () => {
    expect(calcularOrcamento([{ horas: 10, custoHora: 100 }], null).margemPct).toBeNull();
    expect(calcularOrcamento([{ horas: 10, custoHora: 100 }], 0).margemPct).toBeNull();
    const r = calcularOrcamento([{ horas: 100, custoHora: 700 }], 50000);
    expect(r.acimaDoContrato).toBe(true);
    expect(r.margemPct).toBe(-40);
  });

  it("arredonda centavos", () => {
    expect(calcularOrcamento([{ horas: 3, custoHora: 33.333 }], 1000).custo).toBe(100);
  });
});

describe("disciplinaAberta e textoComunicado", () => {
  it("concluída e pausada não contam como abertas, em qualquer caixa", () => {
    expect(disciplinaAberta("Concluído")).toBe(false);
    expect(disciplinaAberta("concluido")).toBe(false);
    expect(disciplinaAberta("Pausada")).toBe(false);
    expect(disciplinaAberta("Em Andamento")).toBe(true);
    expect(disciplinaAberta(null)).toBe(true);
  });

  it("comunicado cita cliente, projeto, entrega e quantidade, sem prometer data", () => {
    const t = textoComunicado({ cliente: "Cliente Exemplo", projeto: "Aurora", entrega: "07/11/2026", abertas: 2 });
    expect(t.assunto).toBe("Projeto Aurora: acompanhamento da entrega");
    expect(t.mensagem).toContain("Olá, Cliente Exemplo.");
    expect(t.mensagem).toContain("prevista para 07/11/2026");
    expect(t.mensagem).toContain("2 disciplina(s) em andamento");
    expect(t.mensagem).toContain("Vamos confirmar com você a data de entrega");
  });

  it("sem data de entrega a frase não fica quebrada", () => {
    const t = textoComunicado({ cliente: "C", projeto: "P", entrega: null, abertas: 1 });
    expect(t.mensagem).toContain("entrega do projeto P e ainda há");
  });
});
