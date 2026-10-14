import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampoAcesso {
  id: string;
  nome: string;
  email: string | null;
  login_gerado: boolean;
  ativo: boolean;
  ultimo_acesso: string | null;
  convite_pendente: boolean;
}

export function useCampoAcessos(obraId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["campo-acessos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campo_listar_contas_obra", { p_obra_id: obraId! });
      if (error) throw error;
      return (data ?? []) as unknown as CampoAcesso[];
    },
    enabled: !!obraId,
  });

  const revogar = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.rpc("campo_revogar_acesso", { p_account_id: accountId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campo-acessos", obraId] });
    },
  });

  return {
    acessos: query.data ?? [],
    isLoading: query.isLoading,
    revogar,
  };
}
