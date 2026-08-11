import { describe, expect, it } from "vitest";
import { detectPreset, rangeForPreset } from "./periodo";

// Data fixa de referência para testes determinísticos: 15/03/2026 (domingo).
const NOW = new Date(2026, 2, 15, 12, 0, 0);

describe("rangeForPreset", () => {
  it("mes-atual cobre o mês corrente inteiro", () => {
    const r = rangeForPreset("mes-atual", NOW);
    expect(r.from).toEqual(new Date(2026, 2, 1, 0, 0, 0));
    expect(r.to?.getMonth()).toBe(2);
    expect(r.to?.getDate()).toBe(31);
  });

  it("mes-anterior cobre o mês anterior inteiro", () => {
    const r = rangeForPreset("mes-anterior", NOW);
    expect(r.from).toEqual(new Date(2026, 1, 1, 0, 0, 0));
    expect(r.to?.getMonth()).toBe(1);
    expect(r.to?.getDate()).toBe(28);
  });

  it("ultimos-30 volta 30 dias a partir de agora", () => {
    const r = rangeForPreset("ultimos-30", NOW);
    expect(r.from).toEqual(subDaysLocal(NOW, 30));
    expect(r.to).toEqual(NOW);
  });

  it("ultimos-7 volta 6 dias a partir de agora (7 dias inclusivos)", () => {
    const r = rangeForPreset("ultimos-7", NOW);
    expect(r.from).toEqual(subDaysLocal(NOW, 6));
    expect(r.to).toEqual(NOW);
  });

  it("este-trimestre cobre o trimestre corrente (jan-mar em março)", () => {
    const r = rangeForPreset("este-trimestre", NOW);
    expect(r.from).toEqual(new Date(2026, 0, 1, 0, 0, 0));
    expect(r.to?.getMonth()).toBe(2);
    expect(r.to?.getDate()).toBe(31);
  });

  it("trimestre-passado cobre o trimestre anterior (out-dez/2025)", () => {
    const r = rangeForPreset("trimestre-passado", NOW);
    expect(r.from).toEqual(new Date(2025, 9, 1, 0, 0, 0));
    expect(r.to?.getMonth()).toBe(11);
    expect(r.to?.getDate()).toBe(31);
  });

  it("este-ano cobre o ano corrente", () => {
    const r = rangeForPreset("este-ano", NOW);
    expect(r.from).toEqual(new Date(2026, 0, 1, 0, 0, 0));
    expect(r.to?.getMonth()).toBe(11);
    expect(r.to?.getDate()).toBe(31);
  });

  it("tudo e custom não têm intervalo", () => {
    expect(rangeForPreset("tudo", NOW)).toEqual({ from: undefined, to: undefined });
    expect(rangeForPreset("custom", NOW)).toEqual({ from: undefined, to: undefined });
  });
});

describe("detectPreset", () => {
  it("sem datas = tudo", () => {
    expect(detectPreset(undefined, undefined, NOW)).toBe("tudo");
  });

  it("só uma ponta = custom", () => {
    expect(detectPreset(new Date(2026, 0, 1), undefined, NOW)).toBe("custom");
  });

  it("reconhece o mês atual", () => {
    const r = rangeForPreset("mes-atual", NOW);
    expect(detectPreset(r.from, r.to, NOW)).toBe("mes-atual");
  });

  it("reconhece este-ano", () => {
    const r = rangeForPreset("este-ano", NOW);
    expect(detectPreset(r.from, r.to, NOW)).toBe("este-ano");
  });

  it("reconhece este-trimestre", () => {
    const r = rangeForPreset("este-trimestre", NOW);
    expect(detectPreset(r.from, r.to, NOW)).toBe("este-trimestre");
  });

  it("intervalo arbitrário = custom", () => {
    expect(detectPreset(new Date(2025, 3, 10), new Date(2025, 5, 20), NOW)).toBe("custom");
  });
});

function subDaysLocal(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - days);
  return r;
}
