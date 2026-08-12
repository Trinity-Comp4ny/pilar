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

interface ComprovanteContexto {
  empresaNome?: string;
  mes: number;
  ano: number;
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
  let y = 18;

  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(ctx.empresaNome || "Demonstrativo de pagamento", marginX, y);

  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text("Demonstrativo de pagamento", marginX, y);

  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Competência: ${getMonthLabel(ctx.mes)}/${ctx.ano}`, marginX, y);

  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(item.p_nome, marginX, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(90);
  const infoLinha = [item.p_cargo, item.p_cpf ? `CPF ${item.p_cpf}` : null].filter(Boolean).join("  ·  ");
  if (infoLinha) {
    doc.text(infoLinha, marginX, y);
    y += 5;
  }

  // Variável destrinchado por projeto: é a informação que a equipe pergunta ("de
  // qual projeto veio meu variável"). Cada projeto: m² × valor/m² = subtotal.
  const detalhe = item.detalhe_projetos ?? [];
  const linhasProjetos = detalhe.map((p) => {
    const subtotal = subtotalProjeto(p, item.p_valor_m2);
    return [
      p.nome || "-",
      `${(p.area_m2 || 0).toLocaleString("pt-BR")} m²`,
      `${formatCurrency(item.p_valor_m2 || 0)}/m²`,
      formatCurrency(subtotal),
    ];
  });

  // Sem detalhe por projeto: distingue "não produziu neste mês" (variável = 0) de
  // "folha fechada antes do snapshot existir" (variável > 0, detalhe não capturado),
  // para o texto não contradizer um variável positivo.
  const linhaSemDetalhe: string[][] =
    item.v_variavel > 0
      ? [["Detalhamento por projeto indisponível para esta folha", "-", "-", formatCurrency(item.v_variavel)]]
      : [["Sem projetos no período", "-", "-", formatCurrency(0)]];

  autoTable(doc, {
    startY: y + 2,
    head: [["Projeto", "Área", "Valor/m²", "Subtotal"]],
    body: linhasProjetos.length ? linhasProjetos : linhaSemDetalhe,
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: marginX, right: marginX },
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
    doc.setTextColor(bold ? 20 : 70);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, marginX, ry);
    doc.text(valor, 130, ry, { align: "right" });
    ry += 6;
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
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
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
  doc.save(`comprovantes-folha-${ctx.mes}-${ctx.ano}.pdf`);
}
