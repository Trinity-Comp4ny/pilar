// Exportação do relatório financeiro (CSV e PDF). Funções puras: recebem os
// dados já filtrados e a lista de colunas visíveis (na ordem canônica), de modo
// que o que se exporta é exatamente o que se vê na tela.
import { format } from "date-fns";
import { toast } from "sonner";
import type { ReportRow } from "./useRelatorioData";

export const toCurrency = (value: string | number | null | undefined) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
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
    const str = value === null || value === undefined ? "" : String(value);
    return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
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
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
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
