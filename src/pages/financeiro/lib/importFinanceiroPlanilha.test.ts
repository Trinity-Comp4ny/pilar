import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { csvParaLinhas } from "./importFinanceiro";
import { planilhaParaCsv } from "./importFinanceiroPlanilha";

describe("datas de planilha na importação financeira", () => {
  it("converte um serial formatado sem interferir nas datas americanas de texto da mesma aba", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Data", "Descrição", "Valor"],
      [new Date("2026-11-20T12:00:00Z"), "Serial", 10],
      ["11/21/2026", "Texto americano", 20],
      ["11/03/2026", "Texto ambíguo", 30],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Extrato");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const lido = XLSX.read(bytes, { type: "array", cellDates: true });
    const { linhas, avisos } = csvParaLinhas(planilhaParaCsv(XLSX, lido.Sheets.Extrato));
    expect(linhas.map((linha) => linha.data)).toEqual(["2026-11-20", "2026-11-21", "2026-11-03"]);
    expect(avisos).toHaveLength(1);
  });
});
