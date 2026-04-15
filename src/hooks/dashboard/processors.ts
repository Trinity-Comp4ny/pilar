import { differenceInDays } from "date-fns";
import { getDisplayDate } from "@/lib/dateUtils";
import { LEAD_STATUS } from "@/constants";
import type {
  ProjetoWithCliente,
  LeadRow,
  AlertaRow,
  ReceitaChartRow,
  DespesaChartRow,
  ProximaReceitaRow,
  ProximaDespesaRow,
  DashboardKPI,
  DashboardProjeto,
  DashboardVencimento,
  LeadsPipeline,
  DashboardAlerta,
  ChartDataPoint,
} from "./types";

export const sumValues = (data: { valor: number }[] | null): number =>
  (data || []).reduce((acc, item) => acc + Number(item.valor), 0);

export function buildKPIs(
  receitasMes: { valor: number }[] | null,
  receitasMesAnt: { valor: number }[] | null,
  despesasMes: { valor: number }[] | null,
  despesasMesAnt: { valor: number }[] | null,
  receitasPendentes: { valor: number }[] | null,
  despesasPendentes: { valor: number }[] | null,
  projetosAtivos: number
): DashboardKPI {
  const receitaMes = sumValues(receitasMes);
  const receitaMesAnt = sumValues(receitasMesAnt);
  const despesaMes = sumValues(despesasMes);
  const despesaMesAnt = sumValues(despesasMesAnt);

  return {
    receitaMes,
    despesaMes,
    saldoMes: receitaMes - despesaMes,
    receitaVariacao: receitaMesAnt > 0 ? ((receitaMes - receitaMesAnt) / receitaMesAnt) * 100 : 0,
    despesaVariacao: despesaMesAnt > 0 ? ((despesaMes - despesaMesAnt) / despesaMesAnt) * 100 : 0,
    aReceber: sumValues(receitasPendentes),
    aPagar: sumValues(despesasPendentes),
    projetosAtivos,
  };
}

export function buildProjetos(data: unknown[], now: Date): DashboardProjeto[] {
  const projetos = (data as ProjetoWithCliente[]).map((p) => {
    let progressoPrazo = 0;
    if (p.data_inicio && p.data_previsao) {
      const totalDias = differenceInDays(new Date(p.data_previsao), new Date(p.data_inicio));
      const diasPassados = differenceInDays(now, new Date(p.data_inicio));
      progressoPrazo = totalDias > 0 ? Math.min(100, Math.max(0, (diasPassados / totalDias) * 100)) : 0;
    }

    return {
      id: p.id,
      nome: p.codigo_projeto || p.nome || "Sem nome",
      cliente: p.clientes?.nome || "—",
      status: p.status,
      prioridade: p.prioridade || "Media",
      statusData: p.status_data,
      valorContrato: Number(p.valor_contrato) || 0,
      dataInicio: p.data_inicio,
      dataPrevisao: p.data_previsao,
      dataFinal: p.data_final,
      progressoPrazo: Math.round(progressoPrazo),
    };
  });

  const priorityWeight: Record<string, number> = { Alta: 0, Media: 1, Baixa: 2 };
  projetos.sort((a, b) => (priorityWeight[a.prioridade] ?? 1) - (priorityWeight[b.prioridade] ?? 1));
  return projetos;
}

export function buildLeadsPipeline(data: unknown[]): { pipeline: LeadsPipeline[]; total: number } {
  const leads = data as LeadRow[];
  const pipelineOrder = [
    LEAD_STATUS.NOVO,
    LEAD_STATUS.EM_CONTATO,
    LEAD_STATUS.PROPOSTA,
    LEAD_STATUS.NEGOCIACAO,
    LEAD_STATUS.GANHO,
    LEAD_STATUS.PERDIDO,
  ];

  const pipeline = pipelineOrder
    .map((status) => ({
      status,
      count: leads.filter((l) => l.status === status).length,
      valor: 0,
    }))
    .filter((p) => p.count > 0);

  return { pipeline, total: leads.length };
}

export function buildVencimentos(receitasData: unknown[], despesasData: unknown[], now: Date): DashboardVencimento[] {
  const receitas = (receitasData as ProximaReceitaRow[]).map((r) => ({
    id: r.id,
    tipo: "receita" as const,
    descricao: r.descricao || "Receita",
    valor: Number(r.valor),
    vencimento: r.data_vencimento,
    diasRestantes: differenceInDays(new Date(r.data_vencimento), now),
    status: r.status,
    projeto: r.projetos?.codigo_projeto || null,
    entidade: r.clientes?.nome || null,
  }));

  const despesas = (despesasData as ProximaDespesaRow[]).map((d) => ({
    id: d.id,
    tipo: "despesa" as const,
    descricao: d.descricao || "Despesa",
    valor: Number(d.valor),
    vencimento: d.data_vencimento,
    diasRestantes: differenceInDays(new Date(d.data_vencimento), now),
    status: d.status,
    projeto: d.projetos?.codigo_projeto || null,
    entidade: d.fornecedores?.nome || null,
  }));

  return [...receitas, ...despesas].sort((a, b) => a.diasRestantes - b.diasRestantes).slice(0, 8);
}

export function buildAlertas(data: unknown[]): DashboardAlerta[] {
  return (data as AlertaRow[]).map((a) => ({
    id: a.id,
    tipo: a.tipo,
    severidade: a.severidade,
    titulo: a.titulo,
    mensagem: a.mensagem,
    created_at: a.created_at,
  }));
}

export function processChartData(receitas: ReceitaChartRow[], despesas: DespesaChartRow[]): ChartDataPoint[] {
  const monthsMap = new Map<string, ChartDataPoint>();

  const addToMonth = (item: ReceitaChartRow | DespesaChartRow, type: "receitas" | "despesas") => {
    const dateReceived =
      type === "receitas" ? (item as ReceitaChartRow).data_recebimento : (item as DespesaChartRow).data_pagamento;
    const displayDate = getDisplayDate(dateReceived, item.data_vencimento, item.status);
    if (!displayDate) return;

    const date = new Date(displayDate);
    const monthName = date.toLocaleString("pt-BR", { month: "short" });
    const year = date.getFullYear().toString().slice(-2);
    const key = `${monthName.charAt(0).toUpperCase() + monthName.slice(1).replace(".", "")}/${year}`;
    const sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

    if (!monthsMap.has(key)) {
      monthsMap.set(key, { mes: key, receitas: 0, despesas: 0, saldo: 0, sortKey });
    }

    const entry = monthsMap.get(key)!;
    entry[type] += Number(item.valor);
    entry.saldo = entry.receitas - entry.despesas;
  };

  receitas.forEach((r) => addToMonth(r, "receitas"));
  despesas.forEach((d) => addToMonth(d, "despesas"));

  return Array.from(monthsMap.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(-12);
}
