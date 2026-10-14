import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MedicaoObra {
  id: string;
  rdo_id: string;
  item: string;
  quantidade: number;
  unidade: string;
}

/** Medições do diário de uma obra, agrupadas por rdo_id. */
export function useObraMedicoes(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_medicoes", obraId],
    enabled: !!obraId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Record<string, MedicaoObra[]>> => {
      const { data, error } = await supabase
        .from("obra_rdo_medicao")
        .select("id, rdo_id, item, quantidade, unidade")
        .eq("obra_id", obraId!);
      if (error) throw error;
      const byRdo: Record<string, MedicaoObra[]> = {};
      for (const m of data ?? []) {
        (byRdo[m.rdo_id] ??= []).push(m as MedicaoObra);
      }
      return byRdo;
    },
  });
}
