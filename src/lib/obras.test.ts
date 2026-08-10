import { describe, expect, it } from "vitest";
import {
  calcularAvanco,
  calcularSaldoConta,
  climaLabel,
  condicaoLabel,
  desvioOrcamento,
  pagoPorLabel,
  realizadoPorEtapa,
  SEM_ETAPA,
  STATUS_OBRA_OPCOES,
  totalAdiantadoEscritorio,
} from "./obras";
import { statusLabel } from "./status";

describe("calcularAvanco", () => {
  it("é 0 quando não há tarefas", () => {
    expect(calcularAvanco([])).toBe(0);
  });

  it("é 25% com 1 de 4 concluídas (critério de aceite spec 015)", () => {
    const tarefas = [{ status: "concluida" }, { status: "a_fazer" }, { status: "fazendo" }, { status: "a_fazer" }];
    expect(calcularAvanco(tarefas)).toBe(25);
  });

  it("é 100% quando todas concluídas", () => {
    expect(calcularAvanco([{ status: "concluida" }, { status: "concluida" }])).toBe(100);
  });

  it("arredonda para inteiro", () => {
    // 1 de 3 = 33.33 -> 33
    expect(calcularAvanco([{ status: "concluida" }, { status: "a_fazer" }, { status: "a_fazer" }])).toBe(33);
  });
});

describe("labels de RDO", () => {
  it("traduz clima e condição conhecidos", () => {
    expect(climaLabel("chuva_forte")).toBe("Chuva forte");
    expect(condicaoLabel("paralisada")).toBe("Obra paralisada");
  });

  it("devolve vazio para nulo", () => {
    expect(climaLabel(null)).toBe("");
    expect(condicaoLabel(undefined)).toBe("");
  });
});

describe("status de obra no registry", () => {
  it("todo status de opção resolve label no domínio obra", () => {
    for (const opt of STATUS_OBRA_OPCOES) {
      expect(statusLabel("obra", opt.value)).toBe(opt.label);
    }
  });
});

describe("conta da obra — saldo (spec 016)", () => {
  it("aportes menos despesas (50k − 30k = 20k)", () => {
    const lancamentos = [
      { tipo: "aporte", valor: 50000 },
      { tipo: "despesa", valor: 20000 },
      { tipo: "despesa", valor: 10000 },
    ];
    expect(calcularSaldoConta(lancamentos)).toBe(20000);
  });

  it("permite saldo negativo: despesa sem aporte (−5.000)", () => {
    expect(calcularSaldoConta([{ tipo: "despesa", valor: 5000 }])).toBe(-5000);
  });

  it("conta vazia é 0", () => {
    expect(calcularSaldoConta([])).toBe(0);
  });

  it("aceita valor numeric vindo como string do banco", () => {
    expect(calcularSaldoConta([{ tipo: "aporte", valor: "1500.50" }])).toBe(1500.5);
  });
});

describe("conta da obra — realizado por etapa e desvio", () => {
  it("soma despesas por frente e ignora aportes", () => {
    const r = realizadoPorEtapa([
      { tipo: "aporte", valor: 9999, obra_frente_id: "f1" },
      { tipo: "despesa", valor: 30000, obra_frente_id: "f1" },
      { tipo: "despesa", valor: 15000, obra_frente_id: "f1" },
      { tipo: "despesa", valor: 8000, obra_frente_id: "f2" },
      { tipo: "despesa", valor: 500, obra_frente_id: null },
    ]);
    expect(r).toEqual({ f1: 45000, f2: 8000, [SEM_ETAPA]: 500 });
  });

  it("estouro previsto 40k vs realizado 45k = +5.000 (+12,5%) [critério de aceite]", () => {
    expect(desvioOrcamento(40000, 45000)).toEqual({ valor: 5000, pct: 12.5 });
  });

  it("previsto zero não gera pct (sem base)", () => {
    expect(desvioOrcamento(0, 1000)).toEqual({ valor: 1000, pct: null });
  });
});

describe("conta da obra — adiantamento do escritório (ADR 0013)", () => {
  it("soma só despesas reembolsáveis", () => {
    const lancamentos = [
      { tipo: "despesa", valor: 1000, pago_por: "cliente" },
      { tipo: "despesa", valor: 700, pago_por: "escritorio_reembolsavel" },
      { tipo: "despesa", valor: 300, pago_por: "escritorio_reembolsavel" },
      { tipo: "aporte", valor: 5000, pago_por: null },
    ];
    expect(totalAdiantadoEscritorio(lancamentos)).toBe(1000);
  });
});

describe("labels da conta da obra", () => {
  it("traduz pago_por conhecido e vazio para nulo", () => {
    expect(pagoPorLabel("escritorio_reembolsavel")).toBe("Escritório adiantou (reembolsável)");
    expect(pagoPorLabel(null)).toBe("");
  });
});
