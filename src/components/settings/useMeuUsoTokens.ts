import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MeuUsoTokens {
  tokensCiclo: number;
  limiteMensal: number | null;
}

// O próprio teto (se houver) e consumo do ciclo, para qualquer usuário —
// mesma fonte da tabela do admin (v_uso_tokens_usuario_ciclo), mas cada um só
// enxerga a própria linha de limite (RLS, spec 094); consumo é transparente
// para a empresa toda, igual ao extrato já existente.
export function useMeuUsoTokens() {
  const { profile } = useAuth();

  const query = useQuery({
    queryKey: ["uso-empresa", "meu-limite-tokens", profile?.id],
    enabled: !!profile?.id,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<MeuUsoTokens> => {
      const { data, error } = await supabase
        .from("v_uso_tokens_usuario_ciclo")
        .select("tokens_ciclo, limite_mensal")
        .eq("user_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return { tokensCiclo: data?.tokens_ciclo ?? 0, limiteMensal: data?.limite_mensal ?? null };
    },
  });

  return { meuUso: query.data ?? { tokensCiclo: 0, limiteMensal: null }, isLoading: query.isLoading };
}
