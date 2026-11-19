import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ids das pessoas que existem em Pessoas mas não têm login. Marcá-las com @ não gera
 * aviso (não há inbox para cair), então o composer avisa quem comenta (SPEC 132).
 */
export function usePessoasSemConta() {
  const { data } = useQuery({
    queryKey: ["pessoas-sem-conta"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("id").is("deleted_at", null).is("profile_id", null);
      if (error) throw error;
      return new Set((data ?? []).map((p) => p.id));
    },
  });
  return data ?? new Set<string>();
}
