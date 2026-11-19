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
