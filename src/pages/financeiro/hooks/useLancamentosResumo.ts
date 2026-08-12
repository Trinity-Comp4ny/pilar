import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { filtersToRpcArgs, type LancamentosFilters } from "../components/lancamentosFilters";

export interface LancamentosResumo {
  totalCount: number;
  recebido: number;
  aReceber: number;
  pago: number;
  aPagar: number;
  receitas: number;
  despesas: number;
  saldo: number;
  atrasadosCount: number;
}

const EMPTY: LancamentosResumo = {
  totalCount: 0,
  recebido: 0,
  aReceber: 0,
  pago: 0,
  aPagar: 0,
  receitas: 0,
  despesas: 0,
  saldo: 0,
  atrasadosCount: 0,
};

/**
 * Totais/KPIs do conjunto FILTRADO, direto do banco (get_lancamentos_resumo).
 * Fonte única de KPI e rodapé: sempre batem com o filtro e entre si (spec 033).
 */
export function useLancamentosResumo(filters: LancamentosFilters) {
  const rpcArgs = useMemo(() => filtersToRpcArgs(filters), [filters]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["lancamentos-resumo", rpcArgs],
    queryFn: async (): Promise<LancamentosResumo> => {
      const { data, error } = await supabase.rpc("get_lancamentos_resumo", rpcArgs);
      if (error) throw error;
      const r = (data ?? {}) as Record<string, number | string>;
      const receitas = Number(r.receitas ?? 0);
      const despesas = Number(r.despesas ?? 0);
      return {
        totalCount: Number(r.total_count ?? 0),
        recebido: Number(r.recebido ?? 0),
        aReceber: Number(r.a_receber ?? 0),
        pago: Number(r.pago ?? 0),
        aPagar: Number(r.a_pagar ?? 0),
        receitas,
        despesas,
        saldo: receitas - despesas,
        atrasadosCount: Number(r.atrasados_count ?? 0),
      };
    },
    staleTime: 30 * 1000,
  });

  return { resumo: data ?? EMPTY, isLoading, refetch };
}
