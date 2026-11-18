import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useLeadAtividades(leadId: string) {
  const qc = useQueryClient();
  const key = ["lead-atividades", leadId];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_atividades")
        .select("*")
        .eq("lead_id", leadId)
        .order("ocorrido_em")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });
  const adicionar = useMutation({
    mutationFn: async ({
      texto,
      ocorridoEm,
      mencionados = [],
    }: {
      texto: string;
      ocorridoEm?: string;
      mencionados?: string[];
    }) => {
      const { data: empresaId, error: empresaError } = await supabase.rpc("get_user_empresa_id");
      if (empresaError) throw empresaError;
      if (!empresaId) throw new Error("Empresa não encontrada");
      const { error } = await supabase.from("lead_atividades").insert({
        empresa_id: empresaId,
        lead_id: leadId,
        texto,
        ...(ocorridoEm ? { ocorrido_em: ocorridoEm } : {}),
        mencionados,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Não foi possível salvar a atividade. Tente novamente."),
  });
  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("lead_atividades")
        .delete()
        .eq("id", id)
        .eq("lead_id", leadId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Atividade não removida");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Não foi possível remover a atividade."),
  });
  return { ...query, adicionar, excluir };
}
