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
  dados_simulacao: any;
  observacao: string | null;
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
  aceita: { label: "Aceita", color: "bg-green-100 text-green-800" },
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

      return (data || []).map((p: any) => ({
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
      const { data, error } = await supabase
        .from("propostas")
        .insert(proposta)
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
      const { data, error } = await supabase
        .from("propostas")
        .update(proposta)
        .eq("id", id)
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
