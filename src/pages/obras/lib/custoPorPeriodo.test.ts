import { describe, expect, it } from "vitest";
import { montarOrcadoRealizado, type NoFinanceiro } from "@/lib/orcadoRealizado";
import { montarFisicoFinanceiro } from "./fisicoFinanceiro";
import { desembolsoPorColuna, type ColunaIso } from "./custoPorPeriodo";

const no = (id: string, parent_id: string | null, nivel: string): NoFinanceiro => ({
  id,
  parent_id,
  nivel,
  nome: id,
  ordem: 0,
  created_at: "",
});

const meses: ColunaIso[] = [
  { inicio: "2026-03-01", fim: "2026-03-31" },
  { inicio: "2026-04-01", fim: "2026-04-30" },
];

const ffDe = (
  previsto: Record<string, number>,
  periodos: Record<string, { inicio: string; fim: string } | null>,
  manual?: Map<string, Record<string, number>>
) => {
  const nos = Object.keys(previsto).map((id) => no(id, null, "etapa"));
  const { raizes } = montarOrcadoRealizado(nos, new Map(Object.entries(previsto)), {});
  return montarFisicoFinanceiro(raizes, new Map(Object.entries(periodos)), manual);
};

describe("desembolsoPorColuna", () => {
  it("no zoom em meses, cada coluna recebe exatamente o total do mês do físico-financeiro", () => {
    const ff = ffDe({ e: 6100 }, { e: { inicio: "2026-03-02", fim: "2026-04-30" } });
    const r = desembolsoPorColuna(ff, [], meses);
    expect(r.previsto[0]).toBeCloseTo(ff.totalPorMes["2026-03"], 2);
    expect(r.previsto[1]).toBeCloseTo(ff.totalPorMes["2026-04"], 2);
  });

  it("acompanha o ajuste manual da grade (o Gantt não recalcula por conta própria)", () => {
    const manual = new Map([["e", { "2026-03": 80, "2026-04": 20 }]]);
    const ff = ffDe({ e: 1000 }, { e: { inicio: "2026-03-01", fim: "2026-04-30" } }, manual);
    const r = desembolsoPorColuna(ff, [], meses);
    expect(r.previsto[0]).toBeCloseTo(800, 2);
    expect(r.previsto[1]).toBeCloseTo(200, 2);
  });

  it("em semanas, reparte o total do mês pelos dias das semanas e a soma não muda", () => {
    const ff = ffDe({ e: 3100 }, { e: { inicio: "2026-03-01", fim: "2026-03-31" } });
    const semanas: ColunaIso[] = [
      { inicio: "2026-03-01", fim: "2026-03-07" },
      { inicio: "2026-03-08", fim: "2026-03-31" },
    ];
    const r = desembolsoPorColuna(ff, [], semanas);
    expect(r.previsto[0]).toBeCloseTo(700, 2);
    expect(r.previsto[0] + r.previsto[1]).toBeCloseTo(3100, 2);
  });

  it("item sem período fica em 'sem data', vindo do físico-financeiro", () => {
    const ff = ffDe({ e: 500 }, { e: null });
    const r = desembolsoPorColuna(ff, [], meses);
    expect(r.previstoSemData).toBe(500);
    expect(r.previsto).toEqual([0, 0]);
  });

  it("o realizado cai na coluna da data da despesa; fora da linha do tempo vai à parte", () => {
    const ff = ffDe({}, {});
    const r = desembolsoPorColuna(
      ff,
      [
        { data: "2026-03-10", valor: 100 },
        { data: "2026-04-30", valor: 50 },
        { data: "2026-05-01", valor: 25 },
      ],
      meses
    );
    expect(r.realizado).toEqual([100, 50]);
    expect(r.realizadoForaDaLinha).toBe(25);
  });
});
