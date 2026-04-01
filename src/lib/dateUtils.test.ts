import { describe, it, expect } from "vitest";
import { isInvalidDate, getDisplayDate, formatDateDisplay } from "./dateUtils";

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
