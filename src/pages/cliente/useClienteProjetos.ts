import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";

export interface ClienteProjeto {
  projeto_id: string;
  projeto_nome: string;
  projeto_codigo: string | null;
  projeto_status: string;
  data_inicio: string | null;
  data_previsao: string | null;
  valor_contrato: number | null;
  disciplinas: Array<{ disciplina?: string; status?: string }>;
  empresa_nome: string;
}

export function useClienteProjetos() {
  const token = getPortalToken();
  const q = useQuery({
    queryKey: ["portal-projetos", token],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<ClienteProjeto[]> => {
      if (!token) throw new Error("Não autenticado");
      const { data, error: rpcError } = await supabase.rpc("get_cliente_projetos", { p_token: token });
      if (rpcError) throw rpcError;
      // RPC get_cliente_projetos retorna Json; shape é contrato do backend.
      return (data as unknown as ClienteProjeto[] | null) ?? [];
    },
  });
  return {
    projetos: q.data ?? [],
    loading: q.isLoading,
    tentandoNovamente: q.isFetching && !q.isLoading,
    refazerConsulta: q.refetch,
    error: q.error ? (q.error instanceof Error ? q.error.message : "Erro ao carregar projetos") : null,
  };
}
