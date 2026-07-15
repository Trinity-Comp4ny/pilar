// Hook para buscar dados agregados do gráfico financeiro via RPC server-side.
// Usa get_financial_chart_data que agrega por mês no banco, evitando full-scan no frontend.
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
// Importa como `any` para contornar tipos gerados incompletos enquanto a migration não é aplicada remotamente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase } from "@/integrations/supabase/client";
import type { ChartDataPoint } from "@/hooks/dashboard/types";

interface RpcPorMesRow {
  mes: string; // "YYYY-MM"
  receitas_recebidas: number;
  receitas_pendentes: number;
}

interface RpcDespesasPorMesRow {
  mes: string; // "YYYY-MM"
  despesas_pagas: number;
  despesas_pendentes: number;
}

interface RpcResult {
  por_mes: RpcPorMesRow[];
  despesas_por_mes: RpcDespesasPorMesRow[];
}

function buildChartPoints(rpcResult: RpcResult): ChartDataPoint[] {
  const monthsMap = new Map<string, ChartDataPoint>();

  const labelFromSortKey = (sortKey: string): string => {
    const date = parseISO(`${sortKey}-01`);
    if (!isValid(date)) return sortKey;
    const label = format(date, "MMM/yy", { locale: ptBR }).replace(".", "");
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  for (const row of rpcResult.por_mes ?? []) {
    if (!row.mes) continue;
    const sortKey = row.mes;
    if (!monthsMap.has(sortKey)) {
      monthsMap.set(sortKey, { mes: labelFromSortKey(sortKey), receitas: 0, despesas: 0, saldo: 0, sortKey });
    }
    const entry = monthsMap.get(sortKey)!;
    entry.receitas += Number(row.receitas_recebidas ?? 0) + Number(row.receitas_pendentes ?? 0);
    entry.saldo = entry.receitas - entry.despesas;
  }

  for (const row of rpcResult.despesas_por_mes ?? []) {
    if (!row.mes) continue;
    const sortKey = row.mes;
    if (!monthsMap.has(sortKey)) {
      monthsMap.set(sortKey, { mes: labelFromSortKey(sortKey), receitas: 0, despesas: 0, saldo: 0, sortKey });
    }
    const entry = monthsMap.get(sortKey)!;
    entry.despesas += Number(row.despesas_pagas ?? 0) + Number(row.despesas_pendentes ?? 0);
    entry.saldo = entry.receitas - entry.despesas;
  }

  return Array.from(monthsMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/**
 * Busca dados do gráfico financeiro via RPC server-side.
 * Agrega receitas e despesas por mês sem trazer todas as linhas para o cliente.
 */
export function useFinanceChartData(empresaId: string | null | undefined, dataInicio: Date, dataFim: Date) {
  const inicioStr = format(dataInicio, "yyyy-MM-dd");
  const fimStr = format(dataFim, "yyyy-MM-dd");

  return useQuery<ChartDataPoint[]>({
    queryKey: ["finance-chart-rpc", empresaId, inicioStr, fimStr],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!empresaId) return [];

      // Usa cast para `any` pois os tipos gerados podem não conter ainda esta RPC
      // (migration aplicada localmente, pendente no remote).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_financial_chart_data", {
        p_empresa_id: empresaId,
        p_data_inicio: inicioStr,
        p_data_fim: fimStr,
      });

      if (error) throw error;

      const result = (data ?? null) as RpcResult | null;
      if (!result) return [];

      return buildChartPoints(result);
    },
  });
}
