import type { CellObject, WorkSheet } from "xlsx";

/** Planilhas lidas com cellDates preservam a data explícita de cada célula.
 * ISO evita usar a data de uma célula tipada como evidência de BR ou US para
 * as células de texto da mesma planilha. UTC preserva o dia civil do serial.
 */
export function planilhaParaCsv(XLSX: typeof import("xlsx"), sheet: WorkSheet): string {
  for (const [ref, cell] of Object.entries(sheet)) {
    if (ref.startsWith("!") || !cell || (cell as CellObject).t !== "d") continue;
    const data = (cell as CellObject).v;
    (cell as CellObject).w =
      data instanceof Date && Number.isFinite(data.getTime()) ? data.toISOString().slice(0, 10) : "";
  }
  return XLSX.utils.sheet_to_csv(sheet);
}
