import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Alerta {
  id: string;
  empresa_id: string;
  tipo: string;
  severidade: "low" | "medium" | "high" | "critical";
  titulo: string;
  mensagem: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
  lido: boolean;
  created_at: string;
}

export const SEVERIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-blue-100 text-blue-800" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-800" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-800" },
};

export const useAlertas = (limit = 20) => {
  return useQuery({
    queryKey: ["alertas", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as Alerta[];
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5, // Poll every 5 minutes
  });
};

export const useAlertasNaoLidos = () => {
  return useQuery({
    queryKey: ["alertas-nao-lidos"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alertas")
        .select("*", { count: "exact", head: true })
        .eq("lido", false);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });
};

export const useMarcarAlertaLido = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertaId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("alertas")
        .update({
          lido: true,
          lido_por: user?.id,
          lido_em: new Date().toISOString(),
        })
        .eq("id", alertaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-nao-lidos"] });
    },
  });
};

export const useMarcarTodosLidos = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("alertas")
        .update({
          lido: true,
          lido_por: user?.id,
          lido_em: new Date().toISOString(),
        })
        .eq("lido", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-nao-lidos"] });
    },
  });
};
