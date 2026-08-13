import { describe, expect, it } from "vitest";
import {
  alertasClimaTarefas,
  climaPorCodigo,
  corTemperatura,
  diasComChuva,
  direcaoVento,
  nivelUV,
  type DiaPrevisao,
  type TarefaSensivel,
} from "./clima";

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

describe("alertasClimaTarefas", () => {
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
  const tarefa = (over: Partial<TarefaSensivel>): TarefaSensivel => ({
    id: "t1",
    titulo: "Concretar laje",
    sensivel_clima: "concretagem",
    data_inicio: "2026-08-01",
    prazo: "2026-08-03",
    status: "em_andamento",
    ...over,
  });

  it("alerta concretagem quando um dia da janela tem chuva provável", () => {
    const r = alertasClimaTarefas([tarefa({})], [dia({ data: "2026-08-02", chuvaProb: 80 })]);
    expect(r).toHaveLength(1);
    expect(r[0].motivo).toBe("chuva");
    expect(r[0].data).toBe("2026-08-02");
  });

  it("içamento alerta por vento forte, não por chuva", () => {
    const t = tarefa({ id: "t2", titulo: "Içar viga", sensivel_clima: "icamento" });
    const semAlerta = alertasClimaTarefas([t], [dia({ chuvaProb: 90, ventoMax: 20 })]);
    expect(semAlerta).toHaveLength(0);
    const comAlerta = alertasClimaTarefas([t], [dia({ ventoMax: 55 })]);
    expect(comAlerta[0].motivo).toBe("vento");
  });

  it("ignora tarefa concluída, sem tipo ou sem janela", () => {
    const dias = [dia({ chuvaProb: 90 })];
    expect(alertasClimaTarefas([tarefa({ status: "concluida" })], dias)).toHaveLength(0);
    expect(alertasClimaTarefas([tarefa({ sensivel_clima: null })], dias)).toHaveLength(0);
    expect(alertasClimaTarefas([tarefa({ prazo: null })], dias)).toHaveLength(0);
  });

  it("não alerta quando o dia de chuva está fora da janela da tarefa", () => {
    const r = alertasClimaTarefas([tarefa({})], [dia({ data: "2026-08-10", chuvaProb: 90 })]);
    expect(r).toHaveLength(0);
  });

  it("pega chuva por código mesmo com probabilidade baixa", () => {
    const r = alertasClimaTarefas([tarefa({})], [dia({ data: "2026-08-02", code: 61, chuvaProb: 5 })]);
    expect(r).toHaveLength(1);
  });
});
