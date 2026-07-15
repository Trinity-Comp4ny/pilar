import { describe, it, expect } from "vitest";
import { calcDisciplinasTotais, custoLinha, valorDivergeDaSoma, type DisciplinaLinha } from "./disciplinasCalc";

const linha = (over: Partial<DisciplinaLinha>): DisciplinaLinha => ({
  id: crypto.randomUUID(),
  disciplina: "Estrutural",
  horas_estimadas: 0,
  custo_hora: 0,
  valor_venda: 0,
  ...over,
});

describe("custoLinha", () => {
  it("multiplica horas por custo/hora", () => {
    expect(custoLinha({ horas_estimadas: 10, custo_hora: 150 })).toBe(1500);
  });

  it("retorna 0 quando falta dado", () => {
    expect(custoLinha({ horas_estimadas: 0, custo_hora: 150 })).toBe(0);
  });
});

describe("calcDisciplinasTotais", () => {
  it("soma horas, custo e valor de venda", () => {
    const t = calcDisciplinasTotais([
      linha({ horas_estimadas: 10, custo_hora: 100, valor_venda: 2000 }),
      linha({ horas_estimadas: 5, custo_hora: 200, valor_venda: 1500 }),
    ]);
    expect(t.totalHoras).toBe(15);
    expect(t.totalCusto).toBe(2000); // 10*100 + 5*200
    expect(t.totalValor).toBe(3500);
  });

  it("deriva margem sobre o valor de venda", () => {
    const t = calcDisciplinasTotais([linha({ horas_estimadas: 10, custo_hora: 100, valor_venda: 2000 })]);
    // custo 1000, venda 2000 -> margem 50%
    expect(t.margemPct).toBeCloseTo(50);
  });

  it("margem null quando não há venda", () => {
    const t = calcDisciplinasTotais([linha({ horas_estimadas: 10, custo_hora: 100, valor_venda: 0 })]);
    expect(t.margemPct).toBeNull();
  });

  it("margem negativa quando custo supera venda", () => {
    const t = calcDisciplinasTotais([linha({ horas_estimadas: 10, custo_hora: 300, valor_venda: 1000 })]);
    // custo 3000, venda 1000 -> -200%
    expect(t.margemPct).toBeCloseTo(-200);
  });

  it("lista vazia zera tudo", () => {
    const t = calcDisciplinasTotais([]);
    expect(t).toEqual({ totalHoras: 0, totalCusto: 0, totalValor: 0, margemPct: null });
  });
});

describe("valorDivergeDaSoma", () => {
  it("detecta divergência acima da tolerância", () => {
    expect(valorDivergeDaSoma(3000, 3500)).toBe(true);
  });

  it("não diverge dentro da tolerância de 1 centavo", () => {
    expect(valorDivergeDaSoma(3500.005, 3500)).toBe(false);
  });

  it("não diverge quando não há soma de disciplinas", () => {
    expect(valorDivergeDaSoma(3000, 0)).toBe(false);
  });
});
