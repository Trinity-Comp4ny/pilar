import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContaOpcao {
  id: string;
  nome: string;
}

/** Contas bancárias ativas, para escolher de onde saiu/entrou o dinheiro numa baixa. */
export function useContasOpcoes(enabled = true) {
  const { data } = useQuery({
    queryKey: ["financeiro-contas-opcoes"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ContaOpcao[]> => {
      const { data, error } = await supabase.from("contas").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return (data ?? []).map((c) => ({ id: c.id, nome: c.nome }));
    },
  });
  return data ?? [];
}
