import { describe, expect, it } from "vitest";
import type { Pendencia } from "../hooks/useAgentePendencias";
import { agrupar, contarPorArea, diasDesde, ehPronta, ordenar, plural, somarDias } from "./pendencias";

const base: Pendencia = {
  id: "1",
  empresa_id: "e",
  tipo: "projeto_atrasado",
  area: "prazos",
  severidade: "medium",
  chave: "k",
  referencia_tipo: null,
  referencia_id: null,
  projeto_id: null,
  titulo: "t",
  detalhe: null,
  dados: {},
  link: null,
  acao_sugerida: null,
  vence_em: null,
  status: "aberta",
  adiada_ate: null,
  primeira_deteccao: "2026-10-30T10:00:00Z",
  ultima_deteccao: "2026-11-02T06:25:00Z",
  resolvida_em: null,
  resolvida_motivo: null,
};
const p = (o: Partial<Pendencia>): Pendencia => ({ ...base, ...o });

describe("agrupar", () => {
  it("separa prontas, urgentes, da semana e para planejar", () => {
    const g = agrupar([
      p({ id: "a", severidade: "critical", acao_sugerida: "enviar_cobranca", area: "financeiro" }),
      p({ id: "b", severidade: "high" }),
      p({ id: "c", severidade: "critical" }),
      p({ id: "d", severidade: "medium" }),
      p({ id: "e", severidade: "low" }),
    ]);
    expect(g.prontas.map((x) => x.id)).toEqual(["a"]);
    expect(g.urgentes.map((x) => x.id)).toEqual(["c", "b"]);
    expect(g.semana.map((x) => x.id)).toEqual(["d"]);
    expect(g.planejar.map((x) => x.id)).toEqual(["e"]);
  });

  it("a pronta sai dos urgentes mesmo sendo crítica", () => {
    const g = agrupar([p({ severidade: "critical", acao_sugerida: "enviar_cobranca" })]);
    expect(g.urgentes).toHaveLength(0);
    expect(g.prontas).toHaveLength(1);
  });
});

describe("ordenar", () => {
  it("mais urgente primeiro e, na mesma urgência, o mais antigo primeiro", () => {
    const ids = ordenar([
      p({ id: "novo", severidade: "high", primeira_deteccao: "2026-11-01T00:00:00Z" }),
      p({ id: "velho", severidade: "high", primeira_deteccao: "2026-10-01T00:00:00Z" }),
      p({ id: "critico", severidade: "critical", primeira_deteccao: "2026-11-02T00:00:00Z" }),
    ]).map((x) => x.id);
    expect(ids).toEqual(["critico", "velho", "novo"]);
  });

  it("não altera a lista original", () => {
    const lista = [p({ id: "b", severidade: "low" }), p({ id: "a", severidade: "critical" })];
    ordenar(lista);
    expect(lista.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("ehPronta e contarPorArea", () => {
  it("só ação preparada conta como pronta", () => {
    expect(ehPronta(p({ acao_sugerida: "enviar_cobranca" }))).toBe(true);
    expect(ehPronta(p({ acao_sugerida: "marcar_recebido" }))).toBe(false);
    expect(ehPronta(p({ acao_sugerida: null }))).toBe(false);
  });

  it("conta por área, incluindo zeros", () => {
    const c = contarPorArea([p({ area: "financeiro" }), p({ area: "financeiro" }), p({ area: "obra" })]);
    expect(c).toEqual({ financeiro: 2, prazos: 0, orcamento: 0, obra: 1, planejamento: 0, comercial: 0 });
  });
});

describe("datas e plural", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-10-30", 7)).toBe("2026-11-06");
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(somarDias("2026-11-02", -3)).toBe("2026-10-30");
  });

  it("dias desde um instante, sem ficar negativo", () => {
    const agora = new Date("2026-11-02T12:00:00Z");
    expect(diasDesde("2026-10-30T10:00:00Z", agora)).toBe(3);
    expect(diasDesde("2026-11-02T10:00:00Z", agora)).toBe(0);
    expect(diasDesde("2026-11-05T10:00:00Z", agora)).toBe(0);
  });

  it("plural", () => {
    expect(plural(1, "dia", "dias")).toBe("1 dia");
    expect(plural(3, "dia", "dias")).toBe("3 dias");
    expect(plural(0, "item", "itens")).toBe("0 itens");
  });
});
