import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TokenPackStatus {
  status: "pending" | "paid" | "failed" | "canceled";
}

// Sem endpoint novo: RLS de pilar_token_pack_purchases (SPEC 077) já deixa a própria
// empresa ler a compra, então o polling consulta a tabela direto pelo client autenticado.
export function useTokenPackStatus(purchaseId: string | null) {
  return useQuery({
    queryKey: ["token-pack-status", purchaseId],
    enabled: !!purchaseId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "paid" || status === "failed" || status === "canceled") {
        return false;
      }
      return 4000;
    },
    queryFn: async (): Promise<TokenPackStatus> => {
      const { data, error } = await supabase
        .from("pilar_token_pack_purchases")
        .select("status")
        .eq("id", purchaseId!)
        .single();

      if (error) throw new Error(error.message);
      return data as TokenPackStatus;
    },
  });
}
