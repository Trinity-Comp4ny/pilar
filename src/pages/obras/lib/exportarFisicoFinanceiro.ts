import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import { colunasDaEscala, valorDaColuna, type FisicoFinanceiro, type MesChave } from "./fisicoFinanceiro";

/** O quanto do planejamento vai para o arquivo: só fases, fases e etapas, ou tudo (com os serviços). */
export type NivelExportacao = "fases" | "etapas" | "tudo";

export const NIVEIS_EXPORTACAO: ReadonlyArray<{ value: NivelExportacao; label: string }> = [
  { value: "fases", label: "Fases" },
  { value: "etapas", label: "Fases e etapas" },
  { value: "tudo", label: "Tudo" },
];

export type CelulaExport = string | number;

export interface TabelaExport {
  cabecalho: string[];
  /** Cada linha: nome, previsto, um valor por mês e, se houver, o valor sem data. Valores em número, não em texto. */
  linhas: CelulaExport[][];
  /** Quantas linhas finais são rodapé (No período, Acumulado). */
  rodape: number;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

const entra = (nivel: NivelExportacao, n: "fase" | "etapa" | "servico") =>
  nivel === "tudo" || n === "fase" || (nivel === "etapas" && n === "etapa");

/** Monta a tabela do arquivo a partir do físico-financeiro: o que se exporta é o que a grade mostra, mês a mês. */
export function montarTabelaExport(ff: FisicoFinanceiro, nivel: NivelExportacao): TabelaExport {
  const colunas = colunasDaEscala(ff.meses, "mensal");
  const temSemData = ff.semData.valor > 0;
  const cabecalho = ["Item", "Previsto", ...colunas.map((c) => c.rotulo), ...(temSemData ? ["Sem data"] : [])];

  const linhas: CelulaExport[][] = ff.linhas
    .filter((l) => entra(nivel, l.nivel))
    .map((l) => [
      `${"  ".repeat(l.profundidade)}${l.nome}`,
      centavos(l.previsto),
      ...colunas.map((c) => valorDaColuna(l.porMes, c)),
      ...(temSemData ? [centavos(l.semData)] : []),
    ]);

  const noPeriodo: CelulaExport[] = [
    "No período",
    centavos(ff.totalPrevisto),
    ...colunas.map((c) => valorDaColuna(ff.totalPorMes, c)),
    ...(temSemData ? [centavos(ff.semData.valor)] : []),
  ];
  const ultimo = (m: MesChave | undefined) => (m ? (ff.acumuladoPorMes[m] ?? 0) : 0);
  const acumulado: CelulaExport[] = [
    "Acumulado",
    "",
    ...colunas.map((c) => centavos(ultimo(c.meses[c.meses.length - 1]))),
    ...(temSemData ? [""] : []),
  ];

  return { cabecalho, linhas: [...linhas, noPeriodo, acumulado], rodape: 2 };
}

/** Nome do arquivo sem acento nem caractere que o sistema recusa. */
export function nomeArquivoFF(obraNome: string, nivel: NivelExportacao, hoje = new Date()): string {
  const base = obraNome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `fisico-financeiro-${base || "obra"}-${nivel}-${format(hoje, "yyyy-MM-dd")}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Letra da coluna do Excel: 0 vira A, 26 vira AA. */
export function letraColuna(i: number): string {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Planilha da aba única. Número vira célula numérica (estilo 1 = moeda, 2 = negrito); texto vira texto em linha. */
export function montarPlanilhaXML(titulo: string[], tabela: TabelaExport): string {
  const todas: Array<{ celulas: CelulaExport[]; negrito: boolean }> = [
    ...titulo.map((t) => ({ celulas: [t], negrito: true })),
    { celulas: [], negrito: false },
    { celulas: tabela.cabecalho, negrito: true },
    ...tabela.linhas.map((celulas, i) => ({ celulas, negrito: i >= tabela.linhas.length - tabela.rodape })),
  ];
  const rows = todas.map(({ celulas, negrito }, r) => {
    const cs = celulas
      .map((v, c) => {
        const ref = `${letraColuna(c)}${r + 1}`;
        if (typeof v === "number") return `<c r="${ref}" s="1"><v>${v}</v></c>`;
        if (v === "") return "";
        return `<c r="${ref}" t="inlineStr"${negrito ? ' s="2"' : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      })
      .join("");
    return `<row r="${r + 1}">${cs}</row>`;
  });
  return `${XML}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="42" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

const ESTILOS = `${XML}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

function baixar(blob: Blob, nome: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", nome);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface CabecalhoExport {
  obraNome: string;
  nivelRotulo: string;
  geradoEm?: Date;
}

function linhasDoCabecalho({ obraNome, nivelRotulo, geradoEm = new Date() }: CabecalhoExport, tabela: TabelaExport) {
  const meses = tabela.cabecalho.filter((_, i) => i >= 2);
  const periodo = meses.length ? `${meses[0]} a ${meses[meses.length - 1]}` : "";
  return [
    `Físico-financeiro — ${obraNome}`,
    `Nível: ${nivelRotulo}${periodo ? ` · Período: ${periodo}` : ""}`,
    `Gerado em ${format(geradoEm, "dd/MM/yyyy HH:mm")}`,
  ];
}

export async function baixarXLSX(tabela: TabelaExport, cab: CabecalhoExport, nomeArquivo: string) {
  const { default: PizZip } = await import("pizzip");
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `${XML}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );
  zip.file(
    "xl/workbook.xml",
    `${XML}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Físico-financeiro" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );
  zip.file("xl/styles.xml", ESTILOS);
  zip.file("xl/worksheets/sheet1.xml", montarPlanilhaXML(linhasDoCabecalho(cab, tabela), tabela));
  baixar(
    zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${nomeArquivo}.xlsx`
  );
}

export async function baixarPDF(tabela: TabelaExport, cab: CabecalhoExport, nomeArquivo: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });
  const [titulo, nivel, gerado] = linhasDoCabecalho(cab, tabela);
  doc.setFontSize(14);
  doc.text(titulo, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(nivel, 14, 21);
  doc.text(gerado, 14, 26);

  const moeda = (v: CelulaExport) => (typeof v === "number" ? formatCurrency(v) : v);
  const corpo = tabela.linhas.map((l) => l.map((v, i) => (i === 0 ? v : moeda(v))));
  autoTable(doc, {
    head: [tabela.cabecalho],
    body: corpo,
    startY: 31,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60] },
    columnStyles: { 0: { cellWidth: 55 } },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index >= corpo.length - tabela.rodape) d.cell.styles.fontStyle = "bold";
      if (d.section === "body" && d.column.index > 0) d.cell.styles.halign = "right";
    },
  });
  doc.save(`${nomeArquivo}.pdf`);
}
