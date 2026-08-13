import { describe, expect, it } from "vitest";
import { buildYearRange, getMonthLabel, MONTHS } from "./types";

describe("getMonthLabel", () => {
  it("mapeia 1..12 para o nome do mês em português", () => {
    expect(getMonthLabel(1)).toBe("Janeiro");
    expect(getMonthLabel(8)).toBe("Agosto");
    expect(getMonthLabel(12)).toBe("Dezembro");
  });

  it("mês fora do intervalo devolve string vazia (sem quebrar o comprovante)", () => {
    expect(getMonthLabel(0)).toBe("");
    expect(getMonthLabel(13)).toBe("");
    expect(getMonthLabel(-1)).toBe("");
  });

  it("MONTHS tem os 12 meses", () => {
    expect(MONTHS).toHaveLength(12);
  });
});

describe("buildYearRange", () => {
  it("gera janela de 5 anos centrada em (ano - 2 .. ano + 2)", () => {
    expect(buildYearRange(2026)).toEqual([2024, 2025, 2026, 2027, 2028]);
  });

  it("funciona na virada de década", () => {
    expect(buildYearRange(2020)).toEqual([2018, 2019, 2020, 2021, 2022]);
  });
});
