import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, subMonths, differenceInCalendarDays, addDays, format } from "date-fns";
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

export const useDashboardData = (dateFrom?: Date, dateTo?: Date) => {
  const fromKey = dateFrom?.toISOString() ?? null;
  const toKey = dateTo?.toISOString() ?? null;

  return useQuery({
    queryKey: ["dashboard-v2", fromKey, toKey],
    queryFn: async (): Promise<DashboardData> => {
      const now = new Date();
      const periodoStart = dateFrom ?? startOfMonth(now);
      const periodoEnd = dateTo ?? endOfMonth(now);

      // Período anterior de mesma duração para variação %
      const duracao = differenceInCalendarDays(periodoEnd, periodoStart);
      const prevEnd = addDays(periodoStart, -1);
      const prevStart = addDays(prevEnd, -duracao);

      const chartStart = subMonths(now, 11);

      const results = await buildDashboardQueries(now, periodoStart, periodoEnd, prevStart, prevEnd, chartStart);

      // supabase-js resolve com { data, error } mesmo em falha (não rejeita a promise).
      // Sem isto, uma query que falha (RLS/rede) viraria "tudo zerado" na tela em vez de erro.
      const firstError = results.find((r) => "error" in r && r.error)?.error;
      if (firstError) throw firstError;

      const projetosData = results[6].data || [];
      const projetosAtivos = results[14].count ?? 0;

      const kpis = buildKPIs(
        results[0].data,
        results[1].data,
        results[2].data,
        results[3].data,
        results[4].data,
        results[5].data,
        projetosAtivos,
        format(periodoStart, "yyyy-MM-dd"),
        format(periodoEnd, "yyyy-MM-dd"),
        format(prevStart, "yyyy-MM-dd"),
        format(prevEnd, "yyyy-MM-dd")
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
