import { formatCNPJ, formatPhone } from "@/lib/maskUtils";

export interface LinhaFornecedor {
  nome: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  categorias: string[];
}

export async function exportarFornecedores(
  fornecedores: LinhaFornecedor[],
  categorias: string[],
  incluirCnpj: boolean
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Lista de fornecedores", 14, 15);
  doc.setFontSize(10);
  const descricao = categorias.length ? doc.splitTextToSize(categorias.join(", "), 260) : [];
  if (descricao.length) doc.text(descricao, 14, 22, { maxWidth: 260 });
  autoTable(doc, {
    startY: 22 + 5 * descricao.length,
    head: [["Nome ou razão social", "Categorias", "Contato", "Telefone", "E-mail", ...(incluirCnpj ? ["CNPJ"] : [])]],
    body: fornecedores.map((f) => [
      f.nome,
      f.categorias.join(", ") || "Sem categoria",
      f.contato ?? "",
      f.telefone ? formatPhone(f.telefone) : "",
      f.email ?? "",
      ...(incluirCnpj ? [f.cnpj ? formatCNPJ(f.cnpj) : ""] : []),
    ]),
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: { fontSize: 9, overflow: "linebreak" },
  });
  doc.save("fornecedores.pdf");
}

/** As exportações respeitam os fornecedores que já passaram pelos filtros da tela. */
export type FormatoExportacaoFornecedores = "pdf" | "csv" | "xlsx";

function cabecalho(incluirCnpj: boolean): string[] {
  return ["Nome ou razão social", "Categorias", "Contato", "Telefone", "E-mail", ...(incluirCnpj ? ["CNPJ"] : [])];
}

export function linhasParaExportacao(fornecedores: LinhaFornecedor[], incluirCnpj: boolean): string[][] {
  return [
    cabecalho(incluirCnpj),
    ...fornecedores.map((f) => [
      f.nome,
      f.categorias.join(", ") || "Sem categoria",
      f.contato ?? "",
      f.telefone ? formatPhone(f.telefone) : "",
      f.email ?? "",
      ...(incluirCnpj ? [f.cnpj ? formatCNPJ(f.cnpj) : ""] : []),
    ]),
  ];
}

/** Impede que campos controlados por terceiros virem fórmulas no Excel ao abrir CSV. */
function celulaSeguraCsv(valor: string): string {
  const texto = /^[=+@-]/.test(valor.trimStart()) ? "'" + valor : valor;
  return '"' + texto.replace(/"/g, '""') + '"';
}

export function gerarCsvFornecedores(fornecedores: LinhaFornecedor[], incluirCnpj: boolean): string {
  const linhas = linhasParaExportacao(fornecedores, incluirCnpj);
  return "\uFEFF" + linhas.map((linha) => linha.map(celulaSeguraCsv).join(";")).join("\r\n") + "\r\n";
}

export async function exportarFornecedoresPlanilha(
  fornecedores: LinhaFornecedor[],
  incluirCnpj: boolean,
  formato: "csv" | "xlsx"
): Promise<void> {
  if (formato === "csv") {
    const csv = gerarCsvFornecedores(fornecedores, incluirCnpj);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fornecedores.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }

  const XLSX = await import("xlsx");
  const dados = linhasParaExportacao(fornecedores, incluirCnpj);
  const folha = XLSX.utils.aoa_to_sheet(dados);
  folha["!cols"] = dados[0].map((_, index) => ({
    wch: dados.reduce((max, linha) => Math.min(54, Math.max(max, (linha[index] ?? "").length + 2)), 16),
  }));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, folha, "Fornecedores");
  XLSX.writeFile(livro, "fornecedores.xlsx");
}
