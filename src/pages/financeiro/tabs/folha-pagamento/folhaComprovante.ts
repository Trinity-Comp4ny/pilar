// Comprovante de pagamento da folha (PDF). NÃO é holerite CLT: o modelo aqui é
// salário fixo + variável por m² de produtividade, sem INSS/IRRF/FGTS. O
// documento é um demonstrativo interno de repasse + bônus, deixado explícito no
// rodapé para não gerar confusão com holerite trabalhista.
//
// Gera no cliente (jsPDF + autotable, já usados em relatorioExport.ts). Um clique
// baixa o comprovante de uma pessoa; o lote sai como um único PDF com uma página
// por colaborador (sem dependência de zip).
import type { jsPDF as JsPDFType } from "jspdf";
import { formatCurrency } from "@/lib/utils";
import { getMonthLabel } from "./types";
import type { FolhaItem } from "./types";
import { subtotalProjeto } from "./folhaCalc";
import { formatPercent } from "@/lib/format";

interface ComprovanteContexto {
  empresaNome?: string;
  /** Logo da empresa em data URL (PNG/JPEG). Opcional: sem ela sai só o nome. */
  empresaLogo?: string;
  mes: number;
  ano: number;
}

// Paleta da marca (src/styles/tokens.css): tinta, verde da marca e verde suave.
const INK: [number, number, number] = [26, 26, 26];
const BRAND_SOFT: [number, number, number] = [236, 249, 229];
const PAGE_W = 210;
const PAGE_H = 297;

// Símbolo do Pilar (public/pilar-logo.svg) em vetor: sem imagem, nítido em qualquer zoom.
// viewBox 110.4 x 90.4; `w` é a largura final em mm.
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

// Marca discreta no topo e rodapé de cada página: símbolo no canto superior direito e,
// no rodapé, filete cinza + "Gerado pela Pilar · pilarsoft.com.br" à esquerda e página à direita.
function decorarPaginas(doc: JsPDFType) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    desenharMarca(doc, PAGE_W - 14 - 8, 13, 8, INK);
    doc.setDrawColor(232, 232, 228);
    doc.setLineWidth(0.3);
    doc.line(14, PAGE_H - 15, PAGE_W - 14, PAGE_H - 15);
    desenharMarca(doc, 14, PAGE_H - 12, 5, INK);
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text("Gerado pela Pilar  ·  pilarsoft.com.br", 21, PAGE_H - 8.3);
    doc.text(`Página ${i} de ${total}`, PAGE_W - 14, PAGE_H - 8.3, { align: "right" });
  }
}

// Desenha o comprovante de uma pessoa a partir de um Y inicial e devolve o Y
// final, para o lote conseguir encadear várias pessoas por documento.
async function desenharComprovante(
  doc: JsPDFType,
  autoTable: (doc: JsPDFType, options: object) => void,
  item: FolhaItem,
  ctx: ComprovanteContexto
): Promise<number> {
  const marginX = 14;

  // Cabeçalho claro: logo/nome da empresa à esquerda.
  let textoX = marginX;
  if (ctx.empresaLogo) {
    try {
      doc.addImage(ctx.empresaLogo, marginX, 12, 18, 18);
      textoX = marginX + 23;
    } catch {
      // Logo ilegível (formato não suportado): segue só com o nome.
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(ctx.empresaNome || "Demonstrativo de pagamento", textoX, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  doc.text("Demonstrativo de pagamento", textoX, 26.5);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Competência: ${getMonthLabel(ctx.mes)}/${ctx.ano}`, textoX, 32);
  doc.setDrawColor(230, 230, 226);
  doc.setLineWidth(0.3);
  doc.line(marginX, 38, PAGE_W - marginX, 38);

  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(item.p_nome, marginX, y);
  doc.setFont("helvetica", "normal");
  y += 5.5;
  doc.setFontSize(9);
  doc.setTextColor(90);
  const infoLinha = [item.p_cargo, item.p_cpf ? `CPF ${item.p_cpf}` : null].filter(Boolean).join("  ·  ");
  if (infoLinha) {
    doc.text(infoLinha, marginX, y);
    y += 5;
  }

  // Variável destrinchado por projeto: é a informação que a equipe pergunta ("de
  // qual projeto veio meu variável"). Cada projeto: m² × valor/m² + valor do
  // projeto × percentual = subtotal. A coluna de cada regra só sai se a pessoa
  // ganha por ela.
  const percentual = item.p_percentual ?? 0;
  const temPercentual = percentual > 0;
  const temM2 = (item.p_valor_m2 || 0) > 0 || !temPercentual;
  const detalhe = item.detalhe_projetos ?? [];
  const linhasProjetos = detalhe.map((p) => [
    p.nome || "-",
    ...(temM2 ? [`${(p.area_m2 || 0).toLocaleString("pt-BR")} m²`, `${formatCurrency(item.p_valor_m2 || 0)}/m²`] : []),
    ...(temPercentual ? [`${formatPercent(percentual)} de ${formatCurrency(p.valor_base ?? 0)}`] : []),
    formatCurrency(subtotalProjeto(p, item.p_valor_m2, percentual)),
  ]);
  const cabecalho = [
    "Projeto",
    ...(temM2 ? ["Área", "Valor/m²"] : []),
    ...(temPercentual ? ["Percentual"] : []),
    "Subtotal",
  ];
  const vazias = Array(cabecalho.length - 2).fill("-");

  // Sem detalhe por projeto: distingue "não produziu neste mês" (variável = 0) de
  // "folha fechada antes do snapshot existir" (variável > 0, detalhe não capturado),
  // para o texto não contradizer um variável positivo.
  const linhaSemDetalhe: string[][] =
    item.v_variavel > 0
      ? [["Detalhamento por projeto indisponível para esta folha", ...vazias, formatCurrency(item.v_variavel)]]
      : [["Sem projetos no período", ...vazias, formatCurrency(0)]];

  autoTable(doc, {
    startY: y + 2,
    head: [cabecalho],
    body: linhasProjetos.length ? linhasProjetos : linhaSemDetalhe,
    theme: "grid",
    headStyles: { fillColor: [240, 240, 238], textColor: INK, fontSize: 8, fontStyle: "bold" },
    tableLineColor: [230, 230, 226],
    margin: { left: marginX, right: marginX, bottom: 22 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: Object.fromEntries(cabecalho.slice(1).map((_, i) => [i + 1, { halign: "right" as const }])),
  });

  // autotable grava a posição final em doc.lastAutoTable.finalY
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  let ry = finalY + 8;

  const resumo: [string, string][] = [
    ["Salário fixo", formatCurrency(item.p_salario_fixo)],
    ["Variável (produtividade)", formatCurrency(item.v_variavel)],
    ["Total a receber", formatCurrency(item.v_total)],
  ];
  doc.setFontSize(10);
  resumo.forEach(([label, valor], i) => {
    const bold = i === resumo.length - 1;
    if (bold) {
      doc.setFillColor(BRAND_SOFT[0], BRAND_SOFT[1], BRAND_SOFT[2]);
      doc.rect(marginX, ry - 5, PAGE_W - marginX * 2, 8, "F");
    }
    doc.setTextColor(bold ? 26 : 70);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, marginX + 2, ry);
    doc.text(valor, PAGE_W - marginX - 2, ry, { align: "right" });
    ry += bold ? 8 : 6;
  });
  doc.setFont("helvetica", "normal");

  if (item.p_chave_pix) {
    ry += 2;
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Chave PIX: ${item.p_chave_pix}`, marginX, ry);
    ry += 5;
  }

  ry += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.text(
    "Comprovante interno de pagamento (repasse fixo + bônus de produtividade). Não é holerite CLT: não há",
    marginX,
    ry
  );
  doc.text("desconto de INSS, IRRF ou FGTS.", marginX, ry + 4);

  return ry + 8;
}

async function carregarJsPDF() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable: autoTable as unknown as (doc: JsPDFType, options: object) => void };
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function gerarComprovantePDF(item: FolhaItem, ctx: ComprovanteContexto) {
  const { jsPDF, autoTable } = await carregarJsPDF();
  const doc = new jsPDF();
  await desenharComprovante(doc, autoTable, item, ctx);
  decorarPaginas(doc);
  doc.save(`comprovante-${slug(item.p_nome)}-${ctx.mes}-${ctx.ano}.pdf`);
}

// Lote: um PDF com uma página por colaborador. Um clique gera tudo, sem gerar um
// a um (dor levantada pelo ICP).
export async function gerarLoteComprovantesPDF(items: FolhaItem[], ctx: ComprovanteContexto) {
  const { jsPDF, autoTable } = await carregarJsPDF();
  const doc = new jsPDF();
  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage();
    await desenharComprovante(doc, autoTable, items[i], ctx);
  }
  decorarPaginas(doc);
  doc.save(`comprovantes-folha-${ctx.mes}-${ctx.ano}.pdf`);
}
