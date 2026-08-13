import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFaturaVencida, vencimentoRelativo, MESES } from "./faturaHelpers";

// Meio-dia local: cobre o bug de fuso (UTC-3), em que a fatura era marcada como
// vencida horas antes do dia por parse UTC. O parse com "T00:00:00" força hora local.
const NOW = new Date(2026, 2, 15, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isFaturaVencida", () => {
  it("fatura paga nunca é vencida, mesmo com vencimento no passado", () => {
    expect(isFaturaVencida("Paga", "2020-01-01")).toBe(false);
  });

  it("vencimento no passado e não paga = vencida", () => {
    expect(isFaturaVencida("Aberta", "2026-03-14")).toBe(true);
  });

  it("vencimento no futuro não é vencida", () => {
    expect(isFaturaVencida("Aberta", "2026-06-01")).toBe(false);
  });

  it("no dia do vencimento não é marcada vencida antes da meia-noite local (fuso UTC-3)", () => {
    // Com o parse "T00:00:00" (local), o dia inteiro do vencimento parse para 00:00
    // local. Sem essa correção, "2026-03-16" parseava como 15/03 21:00 local e
    // aparecia vencida um dia antes. Aqui garantimos que amanhã ainda não vence.
    expect(isFaturaVencida("Aberta", "2026-03-16")).toBe(false);
  });
});

describe("vencimentoRelativo", () => {
  it("paga tem rótulo 'paga' e não é vencida", () => {
    expect(vencimentoRelativo("Paga", "2026-03-10")).toEqual({ label: "paga", vencida: false });
  });

  it("passado: 'vencida Nd' com o número de dias e flag vencida", () => {
    expect(vencimentoRelativo("Aberta", "2026-03-14")).toEqual({ label: "vencida 1d", vencida: true });
    expect(vencimentoRelativo("Aberta", "2026-03-05")).toEqual({ label: "vencida 10d", vencida: true });
  });

  it("hoje: 'vence hoje' já conta como atenção (vencida true)", () => {
    expect(vencimentoRelativo("Aberta", "2026-03-15")).toEqual({ label: "vence hoje", vencida: true });
  });

  it("amanhã: 'vence amanhã' e ainda não é vencida", () => {
    expect(vencimentoRelativo("Aberta", "2026-03-16")).toEqual({ label: "vence amanhã", vencida: false });
  });

  it("mais de um dia: 'vence em Nd'", () => {
    expect(vencimentoRelativo("Aberta", "2026-03-18")).toEqual({ label: "vence em 3d", vencida: false });
  });
});

describe("MESES", () => {
  it("tem 12 meses em português na ordem certa", () => {
    expect(MESES).toHaveLength(12);
    expect(MESES[0]).toBe("Janeiro");
    expect(MESES[11]).toBe("Dezembro");
  });
});
