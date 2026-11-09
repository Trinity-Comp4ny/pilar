import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  endOfMonth,
  parseDate,
  snapToBoundary,
  startOfDay,
  startOfMonth,
  startOfWeek,
  textoSobreBarra,
  toIso,
} from "./cronograma";
import { earlierOf, isoSlice, laterOf } from "@/pages/projetos/lib/limitesDeData";

// Lacunas da matemática de datas do Gantt (src/lib/cronograma.ts) e dos limites de
// data de disciplina dentro do projeto (limitesDeData).

const d = (iso: string) => parseDate(iso)!;

describe("parseDate", () => {
  it("vazio, nulo e texto inválido viram null", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("31/12/2026")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
  });
  it("data válida fica no dia local, sem escorregar de fuso", () => {
    expect(toIso(d("2026-01-01"))).toBe("2026-01-01");
  });
});

describe("aritmética de dias", () => {
  it("addDays cruza mês e ano; negativo volta", () => {
    expect(toIso(addDays(d("2026-12-30"), 3))).toBe("2027-01-02");
    expect(toIso(addDays(d("2026-03-01"), -1))).toBe("2026-02-28");
  });
  it("diffDays é assinado e conta ano bissexto", () => {
    expect(diffDays(d("2028-02-28"), d("2028-03-01"))).toBe(2);
    expect(diffDays(d("2026-03-10"), d("2026-03-01"))).toBe(-9);
  });
  it("startOfDay zera as horas sem mexer na data original", () => {
    const original = new Date(2026, 4, 5, 15, 30);
    const zerado = startOfDay(original);
    expect(zerado.getHours()).toBe(0);
    expect(original.getHours()).toBe(15);
  });
  it("início/fim de mês, incluindo fevereiro bissexto", () => {
    expect(toIso(startOfMonth(d("2026-07-19")))).toBe("2026-07-01");
    expect(toIso(endOfMonth(d("2028-02-10")))).toBe("2028-02-29");
    expect(toIso(endOfMonth(d("2026-02-10")))).toBe("2026-02-28");
  });
  it("semana começa na segunda; domingo pertence à semana anterior", () => {
    expect(toIso(startOfWeek(d("2026-11-08")))).toBe("2026-11-02");
    expect(toIso(startOfWeek(d("2026-11-02")))).toBe("2026-11-02");
    expect(toIso(startOfWeek(d("2026-11-07")))).toBe("2026-11-02");
  });
});

describe("snapToBoundary", () => {
  it("meses: gruda no dia 1 só a até 1 dia da borda", () => {
    expect(toIso(snapToBoundary(d("2026-09-02"), "months"))).toBe("2026-09-01");
    expect(toIso(snapToBoundary(d("2026-08-31"), "months"))).toBe("2026-09-01");
    expect(toIso(snapToBoundary(d("2026-09-03"), "months"))).toBe("2026-09-03");
  });
  it("semanas: gruda na segunda vizinha", () => {
    expect(toIso(snapToBoundary(d("2026-11-03"), "weeks"))).toBe("2026-11-02");
    expect(toIso(snapToBoundary(d("2026-11-08"), "weeks"))).toBe("2026-11-09");
    expect(toIso(snapToBoundary(d("2026-11-05"), "weeks"))).toBe("2026-11-05");
  });
});

describe("textoSobreBarra", () => {
  it("só o cinza de não iniciado usa texto branco", () => {
    expect(textoSobreBarra("bg-status-unknown")).toBe("text-white");
    expect(textoSobreBarra("bg-positive")).toBe("text-ink");
  });
});

describe("limitesDeData", () => {
  it("isoSlice corta timestamp e ignora vazio", () => {
    expect(isoSlice("2026-11-07T10:00:00Z")).toBe("2026-11-07");
    expect(isoSlice(null)).toBeUndefined();
    expect(isoSlice("")).toBeUndefined();
  });
  it("laterOf/earlierOf escolhem o limite mais restritivo e ignoram nulos", () => {
    expect(laterOf("2026-01-10", null, "2026-03-01T00:00:00Z", undefined)).toBe("2026-03-01");
    expect(earlierOf("2026-01-10", null, "2026-03-01")).toBe("2026-01-10");
  });
  it("sem nenhuma data, sem limite", () => {
    expect(laterOf(null, undefined)).toBeUndefined();
    expect(earlierOf()).toBeUndefined();
  });
});
