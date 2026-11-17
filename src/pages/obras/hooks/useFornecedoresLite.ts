import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Fornecedores da empresa (id e nome), para seletores. */
export function useFornecedoresLite() {
  return useQuery({
    queryKey: ["fornecedores-lite"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
