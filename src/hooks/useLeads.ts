import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";

export interface Lead {
  id: string;
  nome: string;
  email?: string;
  contato?: string;
  status: "Novo" | "Em contato" | "Proposta" | "Negociação" | "Ganho" | "Perdido";
  origem?: string;
  cliente_id?: string;
  motivo_perda?: string;
  convertido_em?: string;
}

export interface LeadInsert {
  nome: string;
  email?: string;
  contato?: string;
  origem?: string;
}

export const useLeads = () => {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
  });
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");

      const { data, error } = await supabase
        .from("leads")
        .insert({
          nome: lead.nome ?? "",
          email: lead.email,
          contato: lead.contato,
          origem: lead.origem,
          status: "Novo",
          empresa_id: empresaId,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead cadastrado", {
        description: "Novo lead foi adicionado com sucesso",
      });
    },
    onError: (err: unknown) => {
      toast.error("Erro ao salvar", {
        description: getSafeErrorMessage(err),
      });
    },
  });
};

export const useUpdateLeadStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leadId,
      newStatus,
      extraFields,
    }: {
      leadId: string;
      newStatus: string;
      extraFields?: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus, ...extraFields })
        .eq("id", leadId);

      if (error) throw error;
      return { leadId, newStatus };
    },
    onMutate: async ({ leadId, newStatus, extraFields }) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });

      const previous = queryClient.getQueryData<Lead[]>(["leads"]);

      queryClient.setQueryData(["leads"], (old: Lead[] | undefined) =>
        (old || []).map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus as Lead["status"], ...extraFields } : lead
        )
      );

      return { previous };
    },
    onSuccess: (_data, { newStatus }) => {
      toast.success("Status atualizado", {
        description: `Lead movido para ${newStatus}`,
      });
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["leads"], context.previous);
      }
      toast.error("Erro ao atualizar status", {
        description: getSafeErrorMessage(error),
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

export const useConvertLeadToClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.rpc("rpc_converter_lead_cliente", {
        p_lead_id: leadId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead convertido!", {
        description: "Cliente criado automaticamente a partir do lead.",
      });
    },
    onError: (err: unknown) => {
      toast.error("Erro na conversão", {
        description: getSafeErrorMessage(err),
      });
    },
  });
};

export const useDeleteLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead excluído");
    },
  });
};

export const useCreatePropostaFromLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Lead) => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Empresa não encontrada");

      const codigo = `PROP-${Date.now().toString(36).toUpperCase()}`;

      const { data: proposta, error } = await supabase
        .from("propostas")
        .insert({
          empresa_id: empresaId,
          lead_id: lead.id,
          titulo: `Proposta — ${lead.nome}`,
          codigo,
          status: "rascunho",
        })
        .select()
        .single();

      if (error) throw error;

      // Atualizar lead status para "Proposta"
      await supabase.from("leads").update({ status: "Proposta" }).eq("id", lead.id);

      return proposta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Proposta criada", { description: "Redirecionando para edição..." });
    },
    onError: (err: unknown) => {
      toast.error("Erro ao criar proposta", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    },
  });
};
