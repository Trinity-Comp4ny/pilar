import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TipoLancamento } from "./useLancamentosUnified";

export interface LancamentoRecente {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
}

type LancamentoRecenteRow = {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
};

// Últimos lançamentos por vencimento, sem filtro de período — atalho da Visão Geral.
export function useLancamentosRecentes(limit = 6) {
  return useQuery({
    queryKey: ["lancamentos-recentes", limit],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<LancamentoRecente[]> => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("id, tipo, descricao, valor, data_vencimento, status")
        .order("data_vencimento", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const rows = (data ?? []) as unknown as LancamentoRecenteRow[];
      return rows.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        descricao: r.descricao,
        valor: Number(r.valor || 0),
        data_vencimento: r.data_vencimento,
        status: r.status,
      }));
    },
  });
}
