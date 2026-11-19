import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const revisoesPendentesKey = (projetoId: string) => ["projeto-revisoes-pendentes", projetoId];

export function useRevisoesPendentes(projetoId: string) {
  return useQuery({
    queryKey: revisoesPendentesKey(projetoId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("portal_entregas")
        .select("id", { count: "exact", head: true })
        .eq("projeto_id", projetoId)
        .eq("status", "pendente")
        .not("numero_revisao", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
