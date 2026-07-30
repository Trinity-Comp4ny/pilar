// Exportação do relatório financeiro (CSV e PDF). Funções puras: recebem os
// dados já filtrados e a lista de colunas visíveis (na ordem canônica), de modo
// que o que se exporta é exatamente o que se vê na tela.
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import type { ReportRow } from "./useRelatorioData";

export const toCurrency = (value: string | number | null | undefined) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return formatCurrency(n);
};

// Em relatório misto (receitas + despesas) somar tudo produz um número sem sentido.
// Nesse caso mostramos o Saldo (receitas − despesas); em relatório de tipo único, o Total.
export const computeReportTotal = (data: ReportRow[]): { label: string; value: number } => {
  const hasReceita = data.some((r) => r.Tipo === "Receita");
  const hasDespesa = data.some((r) => r.Tipo === "Despesa");
  if (hasReceita && hasDespesa) {
    const receitas = data.filter((r) => r.Tipo === "Receita").reduce((a, r) => a + (r.Valor ?? 0), 0);
    const despesas = data.filter((r) => r.Tipo === "Despesa").reduce((a, r) => a + (r.Valor ?? 0), 0);
    return { label: "Saldo", value: receitas - despesas };
  }
  return { label: "Total", value: data.reduce((a, r) => a + (r.Valor ?? 0), 0) };
};

export function generateCSV(data: ReportRow[], columns: (keyof ReportRow)[], filename: string) {
  if (!data.length) {
    toast.error("Sem dados", { description: "Não há dados para exportar." });
    return;
  }

  const escapeCSV = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : String(value);
    // Neutraliza CSV/formula injection: célula iniciada por = + - @ é prefixada
    // com aspa simples para o Excel/Sheets tratar como texto, não fórmula.
    const str = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
  };

  // Exporta só as colunas visíveis, na ordem canônica: o que se vê é o que se exporta.
  const headers = columns.join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        if (c === "Valor") return escapeCSV(toCurrency(row.Valor));
        return escapeCSV(row[c]);
      })
      .join(",")
  );

  // Linha de total (Saldo em relatório misto, Total em tipo único)
  const totalInfo = computeReportTotal(data);
  const totalRow = columns
    .map((col) => {
      if (col === "Tipo") return escapeCSV(totalInfo.label.toUpperCase());
      if (col === "Valor") return escapeCSV(toCurrency(totalInfo.value));
      return "";
    })
    .join(",");

  const csvContent = [headers, ...rows, totalRow].join("\n");
  // BOM UTF-8: sem ele o Excel abre acento quebrado (ç, ã viram lixo). O prefixo
  //  força o Excel a ler o arquivo como UTF-8.
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

// Dispara o download de um Blob sem depender de lib externa.
function triggerDownload(blob: Blob, filename: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface GeneratePDFOpts {
  title: string;
  filename: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function generatePDF(data: ReportRow[], columns: (keyof ReportRow)[], opts: GeneratePDFOpts) {
  const { title, filename, dateFrom, dateTo } = opts;

  // jsPDF (+autotable) pesa >300kb: só baixa o chunk ao exportar de fato.
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.text(title, 14, 16);

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `Período: ${dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"} a ${dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}`,
    14,
    23
  );
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 29);

  // Exporta só as colunas visíveis, na ordem canônica: o que se vê é o que se exporta.
  const tableData = data.map((row) =>
    columns.map((c) => {
      if (c === "Valor") return toCurrency(row.Valor);
      return String(row?.[c] ?? "-");
    })
  );

  // Linha de total (Saldo em relatório misto, Total em tipo único)
  const totalInfo = computeReportTotal(data);
  const totalRow = columns.map((col) => {
    if (col === "Tipo") return totalInfo.label.toUpperCase();
    if (col === "Valor") return toCurrency(totalInfo.value);
    return "";
  });
  tableData.push(totalRow);

  autoTable(doc, {
    head: [columns],
    body: tableData,
    startY: 36,
    theme: "grid",
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
    },
    didParseCell: (hookData) => {
      // Destaca a linha de total
      if (hookData.section === "body" && hookData.row.index === tableData.length - 1) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  doc.save(`${filename}.pdf`);
}

// --- Exportação XLSX ---------------------------------------------------------
// Gera um .xlsx real (OOXML) montando o zip com PizZip, que já vem no bundle via
// docxtemplater. Evita adicionar `xlsx` (SheetJS tem CVE high sem fix no npm, e o
// CI barra em npm audit --audit-level=high) ou `exceljs` (~1MB). Valor vai como
// número (o contador formata a coluna), o resto como texto.

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXML(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Índice de coluna (0-based) para letra de célula: 0 → A, 26 → AA.
function colLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// Estilos: 0=texto, 1=cabeçalho negrito, 2=moeda, 3=moeda negrito (linha de total).
const XLSX_STYLES = `${XML_HEADER}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function textCell(ref: string, value: unknown, style: 0 | 1): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXML(value)}</t></is></c>`;
}

function numberCell(ref: string, value: number, style: 2 | 3): string {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function buildRow(rowIndex: number, cells: string[]): string {
  return `<row r="${rowIndex}">${cells.join("")}</row>`;
}

function buildSheet(data: ReportRow[], columns: (keyof ReportRow)[]): string {
  const rows: string[] = [];

  // Cabeçalho
  rows.push(
    buildRow(
      1,
      columns.map((c, i) => textCell(`${colLetter(i)}1`, c, 1))
    )
  );

  // Dados
  data.forEach((row, r) => {
    const rowNum = r + 2;
    const cells = columns.map((col, i) => {
      const ref = `${colLetter(i)}${rowNum}`;
      if (col === "Valor") {
        const n = Number(row.Valor);
        return Number.isFinite(n) ? numberCell(ref, n, 2) : textCell(ref, "", 0);
      }
      return textCell(ref, row[col], 0);
    });
    rows.push(buildRow(rowNum, cells));
  });

  // Linha de total (Saldo em relatório misto, Total em tipo único)
  const totalInfo = computeReportTotal(data);
  const totalRowNum = data.length + 2;
  const totalCells = columns.map((col, i) => {
    const ref = `${colLetter(i)}${totalRowNum}`;
    if (col === "Tipo") return textCell(ref, totalInfo.label.toUpperCase(), 1);
    if (col === "Valor") return numberCell(ref, totalInfo.value, 3);
    return textCell(ref, "", 0);
  });
  rows.push(buildRow(totalRowNum, totalCells));

  return `${XML_HEADER}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

export async function generateXLSX(data: ReportRow[], columns: (keyof ReportRow)[], filename: string) {
  if (!data.length) {
    toast.error("Sem dados", { description: "Não há dados para exportar." });
    return;
  }

  // PizZip pesa: só baixa o chunk ao exportar de fato.
  const { default: PizZip } = await import("pizzip");
  const zip = new PizZip();

  zip.file(
    "[Content_Types].xml",
    `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    "xl/workbook.xml",
    `${XML_HEADER}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Relatório" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  );

  zip.file(
    "xl/_rels/workbook.xml.rels",
    `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file("xl/styles.xml", XLSX_STYLES);
  zip.file("xl/worksheets/sheet1.xml", buildSheet(data, columns));

  const blob = zip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${filename}.xlsx`);
}
