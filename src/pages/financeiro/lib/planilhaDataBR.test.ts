import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseDataBR } from "./importFinanceiro";

// Regressão: o SheetJS exporta célula de data como m/d/aa, então 03/11 virava
// 11/03 e lançamentos de dia 16 falhavam (mês 16 não existe).
describe("xlsx: datas da planilha chegam em dd/mm/aaaa", () => {
  it("célula de data 03/11/2025 vira 2025-11-03 e dia 16 é válido", () => {
    const ws: XLSX.WorkSheet = {
      A1: { t: "d", v: new Date(Date.UTC(2025, 10, 3)), z: "m/d/yy" },
      A2: { t: "d", v: new Date(Date.UTC(2025, 10, 16)), z: "m/d/yy" },
      "!ref": "A1:A2",
    };
    const buf = XLSX.write(
      { SheetNames: ["a"], Sheets: { a: ws } },
      { type: "array", bookType: "xlsx", cellDates: true }
    );
    const sheet = XLSX.read(buf, { type: "array", cellDates: true }).Sheets.a;
    for (const [ref, cell] of Object.entries(sheet)) {
      if (ref.startsWith("!") || cell.t !== "d") continue;
      const d = cell.v as Date;
      cell.w = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    }
    const [l1, l2] = XLSX.utils.sheet_to_csv(sheet).trim().split(/\r?\n/);
    expect(parseDataBR(l1)).toBe("2025-11-03");
    expect(parseDataBR(l2)).toBe("2025-11-16");
  });
});
