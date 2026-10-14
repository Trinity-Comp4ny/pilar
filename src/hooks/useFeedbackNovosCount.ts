import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const FEEDBACK_NOVOS_KEY = ["ultra-admin", "feedback-novos"] as const;

/**
 * Contador de feedback ainda não triado, pro item "Feedback" do painel do
 * portal ultra admin (SPEC 117). Só roda pra ultra admin: a tabela só é
 * legível por ele (RLS is_ultra_admin).
 */
export function useFeedbackNovosCount(enabled: boolean) {
  return useQuery({
    queryKey: FEEDBACK_NOVOS_KEY,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("feature_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status_interno", "novo");
      if (error) throw error;
      return count ?? 0;
    },
  });
}
