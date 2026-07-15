import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, differenceInCalendarDays, addDays, format } from "date-fns";
import { buildDashboardQueries } from "./dashboard/queries";
import {
  buildKPIs,
  buildProjetos,
  buildLeadsPipeline,
  buildVencimentos,
  buildAlertas,
} from "./dashboard/processors";
import type { DashboardData } from "./dashboard/types";

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

      const q = await buildDashboardQueries(now, periodoStart, periodoEnd, prevStart, prevEnd);

      // supabase-js resolve com { data, error } mesmo em falha (não rejeita a promise).
      // Sem isto, uma query que falha (RLS/rede) viraria "tudo zerado" na tela em vez de erro.
      const firstError = Object.values(q).find((r) => r.error)?.error;
      if (firstError) throw firstError;

      const projetosData = q.projetos.data || [];
      const projetosAtivos = q.projetosAtivosCount.count ?? 0;

      const kpis = buildKPIs(
        q.receitasMes.data,
        q.receitasMesAnt.data,
        q.despesasMes.data,
        q.despesasMesAnt.data,
        q.receitasPendentes.data,
        q.despesasPendentes.data,
        projetosAtivos,
        format(periodoStart, "yyyy-MM-dd"),
        format(periodoEnd, "yyyy-MM-dd"),
        format(prevStart, "yyyy-MM-dd"),
        format(prevEnd, "yyyy-MM-dd")
      );

      const projetos = buildProjetos(projetosData, now);
      const { pipeline: leadsPipeline, total: leadsTotal } = buildLeadsPipeline(q.leads.data || []);
      const proximosVencimentos = buildVencimentos(q.proximasReceitas.data || [], q.proximasDespesas.data || [], now);
      const alertas = buildAlertas(q.alertas.data || []);

      return {
        kpis,
        projetos,
        proximosVencimentos,
        leadsPipeline,
        leadsTotal,
        alertas,
        alertasNaoLidos: q.alertasCount.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });
};
