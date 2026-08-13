import { describe, it, expect } from "vitest";
import { isInvalidDate, getDisplayDate, formatDateDisplay, formatDate, formatDateShort } from "./dateUtils";

describe("isInvalidDate", () => {
  it("returns true for null/undefined/empty", () => {
    expect(isInvalidDate(null)).toBe(true);
    expect(isInvalidDate(undefined)).toBe(true);
    expect(isInvalidDate("")).toBe(true);
  });

  it("returns true for 1969 dates (timestamp 0)", () => {
    expect(isInvalidDate("1969-12-31")).toBe(true);
  });

  it("returns false for valid dates", () => {
    expect(isInvalidDate("2025-01-15")).toBe(false);
    expect(isInvalidDate("2024-06-01")).toBe(false);
  });

  it("returns true for invalid date strings", () => {
    expect(isInvalidDate("not-a-date")).toBe(true);
  });
});

describe("getDisplayDate", () => {
  it("returns data_recebimento for Recebido status", () => {
    expect(getDisplayDate("2025-03-15", "2025-03-01", "Recebido")).toBe("2025-03-15");
    expect(getDisplayDate("2025-03-15", "2025-03-01", "Recebida")).toBe("2025-03-15");
  });

  it("returns data_vencimento for Pendente status", () => {
    expect(getDisplayDate("2025-03-15", "2025-03-01", "Pendente")).toBe("2025-03-01");
  });

  it("falls back to data_vencimento if data_recebimento is invalid for Recebido", () => {
    expect(getDisplayDate(null, "2025-03-01", "Recebido")).toBe("2025-03-01");
  });

  it("falls back to data_recebimento if data_vencimento is invalid for Pendente", () => {
    expect(getDisplayDate("2025-03-15", null, "Pendente")).toBe("2025-03-15");
  });

  it("without status, prioritizes data_recebimento", () => {
    expect(getDisplayDate("2025-03-15", "2025-03-01")).toBe("2025-03-15");
  });

  it("returns null when no valid dates", () => {
    expect(getDisplayDate(null, null)).toBeNull();
    expect(getDisplayDate(null, null, "Pendente")).toBeNull();
  });
});

describe("formatDateDisplay", () => {
  it("formats YYYY-MM-DD to dd/mm/yyyy", () => {
    const result = formatDateDisplay("2025-03-15");
    expect(result).toBe("15/03/2025");
  });

  it("returns - for null/undefined", () => {
    expect(formatDateDisplay(null)).toBe("-");
    expect(formatDateDisplay(undefined)).toBe("-");
  });
});

describe("formatDate — fuso (data pura sem deslocar o dia)", () => {
  it("formata YYYY-MM-DD como dd/mm/aaaa local, sem cair pro dia anterior", () => {
    // Parse com "T00:00:00" força hora local; sem isso, em UTC-3 a data virava o
    // dia anterior (ex.: 01/03 aparecia 28/02).
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });

  it("traço para nulo/vazio", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("")).toBe("-");
  });
});

describe("formatDateShort", () => {
  it("formata só dia/mês", () => {
    expect(formatDateShort("2026-03-01")).toBe("01/03");
  });

  it("traço para nulo", () => {
    expect(formatDateShort(null)).toBe("-");
  });
});
