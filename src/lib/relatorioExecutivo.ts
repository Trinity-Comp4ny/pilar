import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ExecutiveKPIs {
  receitaTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  aReceber: number;
  aPagar: number;
}

export interface ExecutiveProjeto {
  nome: string;
  cliente: string;
  valorContrato: number;
  progresso: number;
}

export interface ExecutiveLeadStatus {
  status: string;
  count: number;
  valor: number;
}

export interface ExecutiveMonthlyRow {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface ExecutiveConta {
  nome: string;
  saldo: number;
}

export interface ExecutiveReportData {
  empresaNome: string;
  empresaLogoUrl?: string | null;
  periodoInicio: Date;
  periodoFim: Date;
  kpis: ExecutiveKPIs;
  topProjetos: ExecutiveProjeto[];
  pipelineLeads: ExecutiveLeadStatus[];
  ultimosSeisMeses: ExecutiveMonthlyRow[];
  contas: ExecutiveConta[];
}

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(v) ? v : 0);

const BRAND: [number, number, number] = [249, 115, 22]; // orange-500
const INK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];

function drawHeader(doc: jsPDF, data: ExecutiveReportData) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Faixa superior brand
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("Relatório Executivo", 14, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(data.empresaNome, 14, 29);

  const periodo = `Período: ${format(data.periodoInicio, "dd/MM/yyyy", { locale: ptBR })} a ${format(
    data.periodoFim,
    "dd/MM/yyyy",
    { locale: ptBR }
  )}`;
  doc.setFontSize(9);
  doc.text(periodo, 14, 35);

  // Linha divisória
  doc.setDrawColor(230);
  doc.line(14, 39, pageWidth - 14, 39);
}

function drawKpis(doc: jsPDF, kpis: ExecutiveKPIs, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 4;
  const cols = 3;
  const cardW = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = 22;

  const cards: Array<{ label: string; value: number; color: [number, number, number] }> = [
    { label: "Receita Total", value: kpis.receitaTotal, color: [16, 185, 129] },
    { label: "Despesa Total", value: kpis.despesaTotal, color: [239, 68, 68] },
    {
      label: "Lucro Líquido",
      value: kpis.lucroLiquido,
      color: kpis.lucroLiquido >= 0 ? [16, 185, 129] : [239, 68, 68],
    },
    { label: "A Receber", value: kpis.aReceber, color: [59, 130, 246] },
    { label: "A Pagar", value: kpis.aPagar, color: [234, 179, 8] },
  ];

  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cardW + gap);
    const y = startY + row * (cardH + gap);

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(230);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(card.label, x + 4, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...card.color);
    doc.text(BRL(card.value), x + 4, y + 16);
  });

  const rows = Math.ceil(cards.length / cols);
  return startY + rows * (cardH + gap);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(title, 14, y);
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Gerado em ${generatedAt}`, 14, pageHeight - 8);
    const right = "Pilar by Labrynth";
    const w = doc.getTextWidth(right);
    doc.text(right, pageWidth - 14 - w, pageHeight - 8);
    doc.text(`${i}/${pageCount}`, pageWidth / 2 - 5, pageHeight - 8);
  }
}

export function generateExecutiveReport(data: ExecutiveReportData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawHeader(doc, data);

  let y = 48;
  drawSectionTitle(doc, "Indicadores", y);
  y += 4;
  y = drawKpis(doc, data.kpis, y);
  y += 6;

  // Top 5 Projetos
  drawSectionTitle(doc, "Top 5 Projetos", y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Projeto", "Cliente", "Valor de Contrato", "Progresso"]],
    body:
      data.topProjetos.length > 0
        ? data.topProjetos.map((p) => [p.nome, p.cliente, BRL(p.valorContrato), `${Math.round(p.progresso)}%`])
        : [["Sem projetos no período", "", "", ""]],
    theme: "grid",
    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Pipeline de Leads
  drawSectionTitle(doc, "Pipeline de Leads", y);
  y += 3;
  const totalLeads = data.pipelineLeads.reduce((acc, l) => acc + l.count, 0);
  autoTable(doc, {
    startY: y,
    head: [["Status", "Quantidade", "Valor Estimado"]],
    body:
      data.pipelineLeads.length > 0
        ? [
            ...data.pipelineLeads.map((l) => [l.status, String(l.count), BRL(l.valor)]),
            [
              { content: "Total", styles: { fontStyle: "bold" } },
              { content: String(totalLeads), styles: { fontStyle: "bold" } },
              {
                content: BRL(data.pipelineLeads.reduce((acc, l) => acc + l.valor, 0)),
                styles: { fontStyle: "bold" },
              },
            ],
          ]
        : [["Sem leads", "0", BRL(0)]],
    theme: "grid",
    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Quebra se faltar espaço
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 20;
  }

  // Receita vs Despesa - últimos 6 meses
  drawSectionTitle(doc, "Receita vs Despesa - Últimos 6 meses", y);
  y += 3;
  const seis = data.ultimosSeisMeses.slice(-6);
  autoTable(doc, {
    startY: y,
    head: [["Mês", "Receitas", "Despesas", "Saldo"]],
    body:
      seis.length > 0
        ? seis.map((m) => [m.mes, BRL(m.receitas), BRL(m.despesas), BRL(m.saldo)])
        : [["Sem dados", BRL(0), BRL(0), BRL(0)]],
    theme: "grid",
    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  // Saldo em Contas
  drawSectionTitle(doc, "Saldo em Contas", y);
  y += 3;
  const totalContas = data.contas.reduce((acc, c) => acc + c.saldo, 0);
  autoTable(doc, {
    startY: y,
    head: [["Conta", "Saldo"]],
    body:
      data.contas.length > 0
        ? [
            ...data.contas.map((c) => [c.nome, BRL(c.saldo)]),
            [
              { content: "Total", styles: { fontStyle: "bold" } },
              { content: BRL(totalContas), styles: { fontStyle: "bold" } },
            ],
          ]
        : [["Sem contas cadastradas", BRL(0)]],
    theme: "grid",
    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);

  return doc;
}
