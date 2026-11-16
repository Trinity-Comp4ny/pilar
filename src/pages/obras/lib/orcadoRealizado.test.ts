import { describe, expect, it } from "vitest";
import { achatarOrcado, montarOrcadoRealizado, type NoFinanceiro } from "./orcadoRealizado";

const no = (id: string, parent_id: string | null, nivel: string, ordem = 0): NoFinanceiro => ({
  id,
  parent_id,
  nivel,
  nome: id.toUpperCase(),
  ordem,
  created_at: "2026-01-01",
});

const nos = [
  no("f1", null, "fase"),
  no("e1", "f1", "etapa"),
  no("s1", "e1", "servico", 1),
  no("s2", "e1", "servico", 2),
];

describe("montarOrcadoRealizado", () => {
  it("soma o previsto dos filhos quando o pai não tem valor próprio", () => {
    const r = montarOrcadoRealizado(
      nos,
      new Map([
        ["s1", 100],
        ["s2", 50],
      ]),
      {}
    );
    expect(r.raizes[0].previsto).toBe(150);
    expect(r.totalPrevisto).toBe(150);
  });

  it("o previsto próprio do pai vale no lugar da soma, sem contar duas vezes", () => {
    const r = montarOrcadoRealizado(
      nos,
      new Map([
        ["e1", 400],
        ["s1", 100],
      ]),
      {}
    );
    expect(r.raizes[0].previsto).toBe(400);
  });

  it("soma o realizado de baixo para cima e inclui a despesa sem etapa no total", () => {
    const r = montarOrcadoRealizado(nos, new Map(), { s1: 30, e1: 20 }, 5);
    expect(r.raizes[0].realizado).toBe(50);
    expect(r.totalRealizado).toBe(55);
  });

  it("monta o caminho e achata respeitando nós recolhidos", () => {
    const r = montarOrcadoRealizado(nos, new Map(), {});
    expect(achatarOrcado(r.raizes).map((l) => l.caminho)).toEqual(["F1", "F1 › E1", "F1 › E1 › S1", "F1 › E1 › S2"]);
    expect(achatarOrcado(r.raizes, new Set(["e1"]))).toHaveLength(2);
  });
});
