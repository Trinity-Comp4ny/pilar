// Fallback do gráfico financeiro: full-scan no cliente que agrega receitas/despesas por mês.
// Só roda quando a RPC agregada (useFinanceChartData) falha, evitando o full-scan no caminho feliz.
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { processChartData } from "@/hooks/dashboard/processors";
import type { ChartDataPoint, ReceitaChartRow, DespesaChartRow } from "@/hooks/dashboard/types";

/**
 * Busca dados do gráfico financeiro direto das tabelas (sem RPC).
 * Fica desabilitado por padrão: `enabled` deve refletir a falha da RPC principal.
 */
export function useFinanceChartFallback(
  empresaId: string | null | undefined,
  chartStart: Date,
  enabled: boolean
) {
  const startStr = format(startOfMonth(chartStart), "yyyy-MM-dd");

  return useQuery<ChartDataPoint[]>({
    queryKey: ["finance-chart-fallback", empresaId, startStr],
    enabled: !!empresaId && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [receitasRes, despesasRes] = await Promise.all([
        supabase
          .from("receitas")
          .select("valor, data_recebimento, data_vencimento, status")
          .gte("data_vencimento", startStr)
          .is("deleted_at", null),
        supabase
          .from("despesas")
          .select("valor, data_pagamento, data_vencimento, status")
          .eq("is_fatura_payment", false)
          .gte("data_vencimento", startStr)
          .is("deleted_at", null),
      ]);

      if (receitasRes.error) throw receitasRes.error;
      if (despesasRes.error) throw despesasRes.error;

      return processChartData(
        (receitasRes.data || []) as ReceitaChartRow[],
        (despesasRes.data || []) as DespesaChartRow[]
      );
    },
  });
}
