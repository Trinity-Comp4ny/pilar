import { describe, expect, it } from "vitest";
import { barPosition, generateColumns, parseDate, todayPosition } from "./cronograma";

const jan1 = parseDate("2026-01-01")!;
const jun30 = parseDate("2026-06-30")!;

describe("generateColumns", () => {
  it("gera uma coluna por mês no intervalo (jan–jun = 6)", () => {
    const cols = generateColumns(jan1, jun30, "months");
    expect(cols).toHaveLength(6);
    expect(cols[0].label).toContain("jan");
  });

  it("gera colunas semanais cobrindo o intervalo", () => {
    const cols = generateColumns(jan1, parseDate("2026-01-28")!, "weeks");
    // 4 semanas cheias + a semana-âncora que começa antes do dia 1
    expect(cols.length).toBeGreaterThanOrEqual(4);
  });
});

describe("barPosition", () => {
  it("barra do início ao meio do intervalo fica em ~0% e ~50% de largura", () => {
    const meio = parseDate("2026-03-31")!; // ~metade de jan..jun
    const { leftPct, widthPct } = barPosition(jan1, meio, jan1, jun30);
    expect(leftPct).toBe(0);
    expect(widthPct).toBeGreaterThan(45);
    expect(widthPct).toBeLessThan(55);
  });

  it("nunca deixa a barra estourar o fim (left + width <= 100)", () => {
    const { leftPct, widthPct } = barPosition(parseDate("2026-06-01")!, parseDate("2026-12-01")!, jan1, jun30);
    expect(leftPct + widthPct).toBeLessThanOrEqual(100);
  });

  it("intervalo degenerado (start === end) não quebra", () => {
    expect(barPosition(jan1, jan1, jan1, jan1)).toEqual({ leftPct: 0, widthPct: 0 });
  });
});

describe("todayPosition", () => {
  it("hoje no meio do intervalo devolve ~50%", () => {
    const pct = todayPosition(jan1, jun30, parseDate("2026-03-31")!);
    expect(pct).toBeGreaterThan(45);
    expect(pct).toBeLessThan(55);
  });

  it("hoje fora do intervalo devolve -1", () => {
    expect(todayPosition(jan1, jun30, parseDate("2027-01-01")!)).toBe(-1);
  });
});
