import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Proposta {
  id: string;
  empresa_id: string;
  lead_id: string | null;
  cliente_id: string | null;
  codigo: string | null;
  titulo: string;
  area_m2: number | null;
  localizacao: string | null;
  valor_proposto: number | null;
  custo_estimado: number | null;
  margem_estimada_pct: number | null;
  prazo_estimado_dias: number | null;
  status: string;
  validade: string | null;
  projeto_id: string | null;
  dados_simulacao: Record<string, unknown> | null;
  observacao: string | null;
  contrato_enviado: boolean;
  contrato_assinado: boolean;
  contrato_recusado: boolean;
  template_id?: string | null;
  campos_extras?: Record<string, string> | null;
  created_at: string;
  // Joins
  cliente_nome?: string;
  lead_nome?: string;
}

export interface PropostaInsert {
  codigo?: string;
  titulo: string;
  lead_id?: string;
  cliente_id?: string;
  area_m2?: number;
  localizacao?: string;
  valor_proposto?: number;
  custo_estimado?: number;
  margem_estimada_pct?: number;
  prazo_estimado_dias?: number;
  validade?: string;
  observacao?: string;
}

export const PROPOSTA_STATUS = {
  RASCUNHO: "rascunho",
  ENVIADA: "enviada",
  ACEITA: "aceita",
  RECUSADA: "recusada",
  EXPIRADA: "expirada",
} as const;

export const PROPOSTA_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  enviada: { label: "Enviada", color: "bg-blue-100 text-blue-800" },
  aceita: { label: "Aceita", color: "bg-positive/10 text-positive" },
  recusada: { label: "Recusada", color: "bg-red-100 text-red-800" },
  expirada: { label: "Expirada", color: "bg-yellow-100 text-yellow-800" },
};

export const usePropostas = () => {
  return useQuery({
    queryKey: ["propostas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propostas")
        .select("*, clientes(nome), leads(nome)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p) => ({
        ...p,
        cliente_nome: p.clientes?.nome || null,
        lead_nome: p.leads?.nome || null,
      })) as Proposta[];
    },
    staleTime: 1000 * 60 * 3,
  });
};

export const useCreateProposta = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposta: PropostaInsert) => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      const { data, error } = await supabase
        .from("propostas")
        .insert({ ...proposta, empresa_id: empresaId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    },
  });
};

export const useUpdateProposta = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...proposta }: Partial<PropostaInsert> & { id: string; status?: string }) => {
      const { data, error } = await supabase.from("propostas").update(proposta).eq("id", id).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    },
  });
};

export const useDeleteProposta = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("propostas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    },
  });
};

export const useConverterProposta = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propostaId: string) => {
      const { data, error } = await supabase.rpc("rpc_converter_proposta_projeto", {
        p_proposta_id: propostaId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
  });
};

export const usePropostaDisciplinas = (propostaId: string | null) => {
  return useQuery({
    queryKey: ["proposta-disciplinas", propostaId],
    queryFn: async () => {
      if (!propostaId) return [];
      const { data, error } = await supabase
        .from("proposta_disciplinas")
        .select("id, proposta_id, disciplina, horas_estimadas, custo_hora, valor_venda")
        .eq("proposta_id", propostaId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!propostaId,
  });
};

export interface PropostaDisciplinaInput {
  disciplina: string;
  horas_estimadas: number;
  custo_hora: number;
  valor_venda: number;
}

/**
 * Substitui, de forma atômica, as disciplinas de uma proposta e recalcula
 * custo_estimado / margem_estimada_pct via RPC transacional.
 */
export const useSalvarPropostaDisciplinas = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propostaId,
      disciplinas,
    }: {
      propostaId: string;
      disciplinas: PropostaDisciplinaInput[];
    }) => {
      // RPC ainda não está nos tipos gerados (migration não aplicada ao remoto);
      // cast segue o padrão de useFinanceChartData.
      const { error } = await (supabase as unknown as { rpc: (fn: string, args: unknown) => Promise<{ error: unknown }> }).rpc(
        "rpc_salvar_proposta_disciplinas",
        { p_proposta_id: propostaId, p_disciplinas: disciplinas }
      );
      if (error) throw error;
    },
    onSuccess: (_data, { propostaId }) => {
      queryClient.invalidateQueries({ queryKey: ["proposta-disciplinas", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    },
  });
};
