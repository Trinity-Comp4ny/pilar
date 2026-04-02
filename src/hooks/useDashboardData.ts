import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, differenceInDays, addDays } from "date-fns";
import { getDisplayDate } from "@/lib/dateUtils";
import { PROJECT_STATUS, LEAD_STATUS } from "@/constants";

export interface DashboardKPI {
  receitaMes: number;
  despesaMes: number;
  saldoMes: number;
  receitaVariacao: number;
  despesaVariacao: number;
  aReceber: number;
  aPagar: number;
  projetosAtivos: number;
}

export interface DashboardProjeto {
  id: string;
  nome: string;
  cliente: string;
  status: string;
  prioridade: string;
  statusData: string | null;
  valorContrato: number;
  dataInicio: string | null;
  dataPrevisao: string | null;
  dataFinal: string | null;
  progressoPrazo: number;
}

export interface DashboardVencimento {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  vencimento: string;
  diasRestantes: number;
  status: string;
  projeto?: string | null;
  entidade?: string | null;
}

export interface LeadsPipeline {
  status: string;
  count: number;
  valor: number;
}

export interface DashboardAlerta {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  mensagem: string;
  created_at: string;
}

export interface ChartDataPoint {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
  sortKey: string;
}

export interface DashboardData {
  kpis: DashboardKPI;
  projetos: DashboardProjeto[];
  proximosVencimentos: DashboardVencimento[];
  leadsPipeline: LeadsPipeline[];
  leadsTotal: number;
  alertas: DashboardAlerta[];
  alertasNaoLidos: number;
  chartData: ChartDataPoint[];
}

export const useDashboardData = () => {
  return useQuery({
    queryKey: ["dashboard-v2"],
    queryFn: async (): Promise<DashboardData> => {
      const now = new Date();
      const mesAtualStart = startOfMonth(now);
      const mesAtualEnd = endOfMonth(now);
      const mesAnteriorStart = startOfMonth(subMonths(now, 1));
      const mesAnteriorEnd = endOfMonth(subMonths(now, 1));
      const chartStart = subMonths(now, 11);

      const [
        receitasMesRes,
        receitasMesAntRes,
        despesasMesRes,
        despesasMesAntRes,
        receitasPendentesRes,
        despesasPendentesRes,
        projetosRes,
        leadsRes,
        alertasRes,
        alertasNaoLidosRes,
        receitasChartRes,
        despesasChartRes,
        proximasReceitasRes,
        proximasDespesasRes,
      ] = await Promise.all([
        supabase
          .from("receitas")
          .select("valor")
          .gte("data_vencimento", mesAtualStart.toISOString())
          .lte("data_vencimento", mesAtualEnd.toISOString())
          .is("deleted_at", null),

        supabase
          .from("receitas")
          .select("valor")
          .gte("data_vencimento", mesAnteriorStart.toISOString())
          .lte("data_vencimento", mesAnteriorEnd.toISOString())
          .is("deleted_at", null),

        supabase
          .from("despesas")
          .select("valor")
          .gte("data_vencimento", mesAtualStart.toISOString())
          .lte("data_vencimento", mesAtualEnd.toISOString())
          .is("deleted_at", null),

        supabase
          .from("despesas")
          .select("valor")
          .gte("data_vencimento", mesAnteriorStart.toISOString())
          .lte("data_vencimento", mesAnteriorEnd.toISOString())
          .is("deleted_at", null),

        supabase
          .from("receitas")
          .select("valor")
          .eq("status", "Pendente")
          .is("deleted_at", null),

        supabase
          .from("despesas")
          .select("valor")
          .eq("status", "Pendente")
          .is("deleted_at", null),

        supabase
          .from("projetos")
          .select("id, codigo_projeto, nome, status, prioridade, status_data, valor_contrato, data_inicio, data_previsao, data_final, cliente_id, clientes(nome)")
          .is("deleted_at", null)
          .in("status", [PROJECT_STATUS.EM_ANDAMENTO, PROJECT_STATUS.PLANEJAMENTO])
          .order("created_at", { ascending: false })
          .limit(8),

        supabase
          .from("leads")
          .select("id, status, nome")
          .is("deleted_at", null),

        supabase
          .from("alertas")
          .select("id, tipo, severidade, titulo, mensagem, created_at")
          .eq("lido", false)
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("alertas")
          .select("*", { count: "exact", head: true })
          .eq("lido", false),

        supabase
          .from("receitas")
          .select("valor, data_recebimento, data_vencimento, status")
          .gte("data_vencimento", startOfMonth(chartStart).toISOString())
          .is("deleted_at", null),

        supabase
          .from("despesas")
          .select("valor, data_pagamento, data_vencimento, status")
          .gte("data_vencimento", startOfMonth(chartStart).toISOString())
          .is("deleted_at", null),

        supabase
          .from("receitas")
          .select("id, descricao, valor, data_vencimento, status, projeto_id, projetos(codigo_projeto), cliente_id, clientes(nome)")
          .eq("status", "Pendente")
          .gte("data_vencimento", now.toISOString())
          .lte("data_vencimento", addDays(now, 30).toISOString())
          .is("deleted_at", null)
          .order("data_vencimento", { ascending: true })
          .limit(5),

        supabase
          .from("despesas")
          .select("id, descricao, valor, data_vencimento, status, projeto_id, projetos(codigo_projeto), fornecedor_id, fornecedores(nome)")
          .eq("status", "Pendente")
          .gte("data_vencimento", now.toISOString())
          .lte("data_vencimento", addDays(now, 30).toISOString())
          .is("deleted_at", null)
          .order("data_vencimento", { ascending: true })
          .limit(5),
      ]);

      const sumValues = (data: { valor: number }[] | null) =>
        (data || []).reduce((acc, item) => acc + Number(item.valor), 0);

      const receitaMes = sumValues(receitasMesRes.data);
      const receitaMesAnt = sumValues(receitasMesAntRes.data);
      const despesaMes = sumValues(despesasMesRes.data);
      const despesaMesAnt = sumValues(despesasMesAntRes.data);

      const kpis: DashboardKPI = {
        receitaMes,
        despesaMes,
        saldoMes: receitaMes - despesaMes,
        receitaVariacao: receitaMesAnt > 0 ? ((receitaMes - receitaMesAnt) / receitaMesAnt) * 100 : 0,
        despesaVariacao: despesaMesAnt > 0 ? ((despesaMes - despesaMesAnt) / despesaMesAnt) * 100 : 0,
        aReceber: sumValues(receitasPendentesRes.data),
        aPagar: sumValues(despesasPendentesRes.data),
        projetosAtivos: (projetosRes.data || []).filter(p => p.status === PROJECT_STATUS.EM_ANDAMENTO).length,
      };

      const projetos: DashboardProjeto[] = (projetosRes.data || []).map((p: any) => {
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

      const leads = leadsRes.data || [];
      const pipelineOrder = [LEAD_STATUS.NOVO, LEAD_STATUS.EM_CONTATO, LEAD_STATUS.PROPOSTA, LEAD_STATUS.NEGOCIACAO, LEAD_STATUS.GANHO, LEAD_STATUS.PERDIDO];
      const leadsPipeline: LeadsPipeline[] = pipelineOrder
        .map((status) => ({
          status,
          count: leads.filter((l: any) => l.status === status).length,
          valor: 0,
        }))
        .filter((p) => p.count > 0);

      const proximosVencimentos: DashboardVencimento[] = [
        ...(proximasReceitasRes.data || []).map((r: any) => ({
          id: r.id,
          tipo: "receita" as const,
          descricao: r.descricao || "Receita",
          valor: Number(r.valor),
          vencimento: r.data_vencimento,
          diasRestantes: differenceInDays(new Date(r.data_vencimento), now),
          status: r.status,
          projeto: r.projetos?.codigo_projeto || null,
          entidade: r.clientes?.nome || null,
        })),
        ...(proximasDespesasRes.data || []).map((d: any) => ({
          id: d.id,
          tipo: "despesa" as const,
          descricao: d.descricao || "Despesa",
          valor: Number(d.valor),
          vencimento: d.data_vencimento,
          diasRestantes: differenceInDays(new Date(d.data_vencimento), now),
          status: d.status,
          projeto: d.projetos?.codigo_projeto || null,
          entidade: d.fornecedores?.nome || null,
        })),
      ].sort((a, b) => a.diasRestantes - b.diasRestantes).slice(0, 8);

      const alertas: DashboardAlerta[] = (alertasRes.data || []).map((a: any) => ({
        id: a.id,
        tipo: a.tipo,
        severidade: a.severidade,
        titulo: a.titulo,
        mensagem: a.mensagem,
        created_at: a.created_at,
      }));

      const chartData = processChartData(
        receitasChartRes.data || [],
        despesasChartRes.data || []
      );

      return {
        kpis,
        projetos,
        proximosVencimentos,
        leadsPipeline,
        leadsTotal: leads.length,
        alertas,
        alertasNaoLidos: alertasNaoLidosRes.count || 0,
        chartData,
      };
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });
};

function processChartData(receitas: any[], despesas: any[]): ChartDataPoint[] {
  const monthsMap = new Map<string, ChartDataPoint>();

  const addToMonth = (item: any, type: "receitas" | "despesas") => {
    const displayDate = getDisplayDate(
      type === "receitas" ? item.data_recebimento : item.data_pagamento,
      item.data_vencimento,
      item.status
    );
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
