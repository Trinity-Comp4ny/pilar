import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { PROJECT_STATUS } from "@/constants";
import { buildDashboardQueries } from "./dashboard/queries";
import {
  buildKPIs,
  buildProjetos,
  buildLeadsPipeline,
  buildVencimentos,
  buildAlertas,
  processChartData,
} from "./dashboard/processors";
import type { DashboardData, ReceitaChartRow, DespesaChartRow } from "./dashboard/types";

// Re-export types para manter API pública compatível
export type {
  DashboardKPI,
  DashboardProjeto,
  DashboardVencimento,
  LeadsPipeline,
  DashboardAlerta,
  ChartDataPoint,
  DashboardData,
} from "./dashboard/types";

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

      const results = await buildDashboardQueries(
        now,
        mesAtualStart,
        mesAtualEnd,
        mesAnteriorStart,
        mesAnteriorEnd,
        chartStart
      );

      const projetosData = results[6].data || [];
      const projetosAtivos = projetosData.filter(
        (p: { status: string | null }) => p.status === PROJECT_STATUS.EM_ANDAMENTO
      ).length;

      const kpis = buildKPIs(
        results[0].data,
        results[1].data,
        results[2].data,
        results[3].data,
        results[4].data,
        results[5].data,
        projetosAtivos
      );

      const projetos = buildProjetos(projetosData, now);
      const { pipeline: leadsPipeline, total: leadsTotal } = buildLeadsPipeline(results[7].data || []);
      const proximosVencimentos = buildVencimentos(results[12].data || [], results[13].data || [], now);
      const alertas = buildAlertas(results[8].data || []);
      const chartData = processChartData(
        (results[10].data || []) as ReceitaChartRow[],
        (results[11].data || []) as DespesaChartRow[]
      );

      return {
        kpis,
        projetos,
        proximosVencimentos,
        leadsPipeline,
        leadsTotal,
        alertas,
        alertasNaoLidos: results[9].count || 0,
        chartData,
      };
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });
};
