import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";

const STALE_PORTAL = 5 * 60 * 1000;

function msgErro(e: unknown, padrao: string): string {
  return e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? padrao);
}

export interface ClienteReceita {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
}

export interface ClienteProjetoData {
  projeto_id: string;
  cliente_id: string;
  empresa_id: string;
  projeto_nome: string;
  projeto_status: string;
  /** Há proposta "enviada" ligada ao projeto: o cliente pode aprovar pelo portal. */
  proposta_aguardando_aprovacao?: boolean;
  projeto_codigo: string | null;
  data_inicio: string | null;
  data_previsao: string | null;
  data_final: string | null;
  valor_contrato: number | null;
  disciplinas: Array<{
    disciplina?: string;
    status?: string;
    data_inicio?: string;
    data_previsao?: string;
    data_final?: string;
    responsavel_nome?: string;
  }>;
  cliente_nome: string;
  empresa_nome: string;
  receitas: ClienteReceita[];
  portal_entregas_pendentes: number;
}

export function useClienteProjetoData(projetoId: string | undefined) {
  const token = getPortalToken();
  const q = useQuery({
    queryKey: ["portal-projeto", token, projetoId],
    enabled: !!projetoId,
    staleTime: STALE_PORTAL,
    retry: false,
    queryFn: async (): Promise<ClienteProjetoData> => {
      if (!token) throw new Error("Não autenticado");
      const { data: result, error: rpcError } = await supabase.rpc("get_cliente_projeto_detail", {
        p_projeto_id: projetoId!,
        p_token: token,
      });
      if (rpcError) throw rpcError;
      return result as unknown as ClienteProjetoData;
    },
  });
  return {
    data: q.data ?? null,
    loading: q.isLoading,
    error: q.error ? msgErro(q.error, "Erro ao carregar projeto") : null,
    refresh: async () => {
      await q.refetch();
    },
  };
}
