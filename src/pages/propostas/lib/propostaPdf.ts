// PDF padrão da proposta comercial. Um único modelo, preenchido com os dados do
// sistema (cliente, local, data, validade, itens, valor, prazo): o usuário não sobe
// template nem escreve variável. Marca da empresa (logo ou só o nome) no topo e
// símbolo da Pilar discreto no canto; cores e tipografia são as da Pilar.
// Gera no cliente com jsPDF + autotable, carregados sob demanda.
import type { jsPDF as JsPDFType } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/format";

export interface PropostaPdfDados {
  titulo: string;
  tipo?: "projeto" | "obra" | string | null;
  empresaNome?: string;
  /** Logo da empresa em data URL (PNG/JPEG). Sem ela, sai só o nome. */
  empresaLogo?: string;
  cliente?: { nome?: string | null; email?: string | null; contato?: string | null } | null;
  localizacao?: string | null;
  areaM2?: number | null;
  valor?: number | null;
  prazoDias?: number | null;
  validade?: string | null;
  observacao?: string | null;
  itens: { descricao: string; valor: number }[];
  /** Data de emissão (yyyy-mm-dd). Padrão: hoje. */
  emissao?: string;
}

const INK: [number, number, number] = [26, 26, 26];
const BRAND: [number, number, number] = [164, 236, 134];
const BRAND_SOFT: [number, number, number] = [236, 249, 229];
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;

// Símbolo do Pilar em vetor (viewBox 110.4 x 90.4); `w` é a largura final em mm.
function desenharMarca(doc: JsPDFType, x: number, y: number, w: number, cor: [number, number, number]) {
  const k = w / 110.4;
  doc.setDrawColor(cor[0], cor[1], cor[2]);
  doc.setLineWidth(6.4 * k);
  doc.setLineCap("round");
  const traco = (x1: number, y1: number, x2: number, y2: number) =>
    doc.line(x + x1 * k, y + y1 * k, x + x2 * k, y + y2 * k);
  traco(3.2, 3.2, 107.2, 3.2);
  traco(11.2, 19.2, 99.2, 19.2);
  traco(27.2, 31.2, 27.2, 87.2);
  traco(55.2, 31.2, 55.2, 87.2);
  traco(83.2, 31.2, 83.2, 87.2);
}

function decorarPaginas(doc: JsPDFType) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    desenharMarca(doc, PAGE_W - MARGIN - 8, 10, 8, INK);
    doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 15, PAGE_W - MARGIN, PAGE_H - 15);
    desenharMarca(doc, MARGIN, PAGE_H - 12, 5, INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text("Feito com a Pilar  ·  pilarsoft.com.br", MARGIN + 7, PAGE_H - 8.3);
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, PAGE_H - 8.3, { align: "right" });
  }
}

const dataBR = (iso?: string | null) => (iso ? formatDate(iso) : "");

export async function gerarPropostaPdf(dados: PropostaPdfDados): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const emissao = dados.emissao ?? new Date().toISOString().slice(0, 10);

  // Cabeçalho: filete verde, logo (ou só o nome) e título do documento.
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, PAGE_W, 3, "F");
  let textoX = MARGIN;
  if (dados.empresaLogo) {
    try {
      doc.addImage(dados.empresaLogo, MARGIN, 12, 18, 18);
      textoX = MARGIN + 23;
    } catch {
      // Logo ilegível: segue só com o nome.
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(dados.empresaNome || "Proposta comercial", textoX, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  doc.text("Proposta comercial", textoX, 26.5);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Emitida em ${dataBR(emissao)}`, textoX, 32);
  doc.setDrawColor(230, 230, 226);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 38, PAGE_W - MARGIN, 38);

  // Título e destinatário.
  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const tituloLinhas = doc.splitTextToSize(dados.titulo, PAGE_W - MARGIN * 2) as string[];
  doc.text(tituloLinhas, MARGIN, y);
  y += tituloLinhas.length * 6 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(70);
  const linhasInfo: string[] = [];
  if (dados.cliente?.nome) linhasInfo.push(`Para: ${dados.cliente.nome}`);
  const contato = [dados.cliente?.email, dados.cliente?.contato].filter(Boolean).join("  ·  ");
  if (contato) linhasInfo.push(contato);
  if (dados.localizacao) linhasInfo.push(`Local: ${dados.localizacao}`);
  if (dados.tipo !== "obra" && dados.areaM2) {
    linhasInfo.push(`Área: ${dados.areaM2.toLocaleString("pt-BR")} m²`);
  }
  for (const linha of linhasInfo) {
    doc.text(linha, MARGIN, y);
    y += 5;
  }
  y += 3;

  // Escopo e valores.
  const itens = dados.itens.filter((i) => i.descricao.trim() !== "");
  const temValores = itens.some((i) => i.valor > 0);
  if (itens.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [temValores ? ["Escopo", "Valor"] : ["Escopo"]],
      body: itens.map((i) => (temValores ? [i.descricao, formatCurrency(i.valor)] : [i.descricao])),
      margin: { left: MARGIN, right: MARGIN, bottom: 22 },
      styles: { font: "helvetica", fontSize: 9.5, textColor: INK, cellPadding: 2.6 },
      headStyles: { fillColor: BRAND_SOFT, textColor: INK, fontStyle: "bold" },
      columnStyles: temValores ? { 1: { halign: "right", cellWidth: 38 } } : {},
      theme: "plain",
      didDrawCell: (data: { section: string; cell: { x: number; y: number; width: number; height: number } }) => {
        if (data.section !== "body") return;
        doc.setDrawColor(230, 230, 226);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Total em destaque.
  if (dados.valor && dados.valor > 0) {
    if (y > PAGE_H - 50) {
      doc.addPage();
      y = 24;
    }
    doc.setFillColor(BRAND_SOFT[0], BRAND_SOFT[1], BRAND_SOFT[2]);
    doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 16, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(70);
    doc.text("Valor total da proposta", MARGIN + 5, y + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(formatCurrency(dados.valor), PAGE_W - MARGIN - 5, y + 10.4, { align: "right" });
    y += 24;
  }

  // Condições: prazo e validade.
  const condicoes: string[] = [];
  if (dados.prazoDias) condicoes.push(`Prazo estimado: ${dados.prazoDias} dias`);
  if (dados.validade) condicoes.push(`Proposta válida até ${dataBR(dados.validade)}`);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(70);
  for (const c of condicoes) {
    if (y > PAGE_H - 25) {
      doc.addPage();
      y = 24;
    }
    doc.text(c, MARGIN, y);
    y += 5.5;
  }

  if (dados.observacao?.trim()) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    if (y > PAGE_H - 35) {
      doc.addPage();
      y = 24;
    }
    doc.text("Observações", MARGIN, y);
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(70);
    const linhas = doc.splitTextToSize(dados.observacao.trim(), PAGE_W - MARGIN * 2) as string[];
    for (const l of linhas) {
      if (y > PAGE_H - 22) {
        doc.addPage();
        y = 24;
      }
      doc.text(l, MARGIN, y);
      y += 4.8;
    }
  }

  decorarPaginas(doc);
  return doc.output("blob");
}

/** Nome do arquivo: "proposta-titulo-sem-acento.pdf". */
export function nomeArquivoProposta(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `proposta-${base || "comercial"}.pdf`;
}
