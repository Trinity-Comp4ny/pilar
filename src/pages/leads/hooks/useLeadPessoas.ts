import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
/** Menções usam o id de Pessoas, como os comentários das disciplinas; somente quem tem conta. */
export function useLeadPessoas() {
  return useQuery({
    queryKey: ["lead-pessoas-mencao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome")
        .is("deleted_at", null)
        .not("profile_id", "is", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}
