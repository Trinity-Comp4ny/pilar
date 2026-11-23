import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const revisoesPendentesKey = (projetoId: string) => ["projeto-revisoes-pendentes", projetoId];

export function useRevisoesPendentes(projetoId: string) {
  return useQuery({
    queryKey: revisoesPendentesKey(projetoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_entregas")
        .select("id, status, revisao_anterior_id")
        .eq("projeto_id", projetoId)
        .not("numero_revisao", "is", null);
      if (error) throw error;
      const publicadas = data ?? [];
      const substituidas = new Set(publicadas.map((r) => r.revisao_anterior_id));
      const atuais = publicadas.filter((r) => !substituidas.has(r.id));
      return {
        total: atuais.length,
        aprovadas: atuais.filter((r) => r.status === "aprovado").length,
        pendentes: atuais.filter((r) => r.status === "pendente").length,
      };
    },
  });
}
