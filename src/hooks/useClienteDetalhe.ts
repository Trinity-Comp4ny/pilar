import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/hooks/useClientes";

export interface ProjetoResumo {
  id: string;
  codigo_projeto: string | null;
  nome: string;
  status: string;
  valor_contrato: number | null;
  data_inicio: string | null;
  data_previsao: string | null;
  data_final: string | null;
  total_disciplinas: number;
  disciplinas_concluidas: number;
}

export function useClienteDetalhe(clienteId: string) {
  const clienteQuery = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
      if (error) throw error;
      return data ? (data as unknown as Cliente) : null;
    },
    enabled: !!clienteId,
  });

  const projetosQuery = useQuery({
    queryKey: ["cliente-projetos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select(
          "id, codigo_projeto, nome, status, valor_contrato, data_inicio, data_previsao, data_final, projeto_disciplinas(status)"
        )
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => {
        const discs = (p.projeto_disciplinas ?? []) as { status: string }[];
        return {
          id: p.id,
          codigo_projeto: p.codigo_projeto,
          nome: p.nome,
          status: p.status,
          valor_contrato: p.valor_contrato,
          data_inicio: p.data_inicio,
          data_previsao: p.data_previsao,
          data_final: p.data_final,
          total_disciplinas: discs.length,
          disciplinas_concluidas: discs.filter((d) => d.status === "Concluído").length,
        } as ProjetoResumo;
      });
    },
    enabled: !!clienteId,
  });

  const portalStatusQuery = useQuery({
    queryKey: ["portal-status", clienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cliente_portal_accounts")
        .select("id, email")
        .eq("cliente_id", clienteId)
        .eq("ativo", true)
        .maybeSingle();
      return data ? { exists: true, email: data.email as string } : { exists: false, email: null as string | null };
    },
    enabled: !!clienteId,
  });

  return {
    cliente: clienteQuery.data ?? null,
    isLoadingCliente: clienteQuery.isLoading,
    projetos: projetosQuery.data ?? [],
    isLoadingProjetos: projetosQuery.isLoading,
    portalStatus: portalStatusQuery.data,
    isLoadingPortal: portalStatusQuery.isLoading,
    refetchPortal: portalStatusQuery.refetch,
  };
}
