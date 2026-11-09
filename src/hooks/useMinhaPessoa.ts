import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MinhaPessoa = { id: string; nome: string };

/** Pessoa vinculada ao usuário logado (profile_id = auth.uid()). Usada por Meu trabalho e pelo cronograma de projetos. */
export function useMinhaPessoa() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["meu-trabalho", "minha-pessoa", user?.id] as const,
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<MinhaPessoa | null> => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome")
        .eq("profile_id", user!.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}
