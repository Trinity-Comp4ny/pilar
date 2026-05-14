import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";

export interface Lead {
  id: string;
  nome: string;
  sobrenome?: string;
  email?: string;
  contato?: string;
  status: "Novo" | "Em contato" | "Proposta" | "Negociação" | "Ganho" | "Perdido";
  origem?: string;
  cliente_id?: string;
  motivo_perda?: string;
  convertido_em?: string;
  valor_estimado?: number;
  responsavel_id?: string;
  previsao_fechamento?: string;
  empresa_lead?: string;
  cnpj?: string;
  notas?: string;
}

export interface LeadInsert {
  nome: string;
  sobrenome?: string;
  email?: string;
  contato?: string;
  origem?: string;
  valor_estimado?: number;
  responsavel_id?: string;
  previsao_fechamento?: string;
  empresa_lead?: string;
  cnpj?: string;
  notas?: string;
}

// ---------------------------------------------------------------------------
// Hook paginado — use para listagens grandes (1000+ leads).
// O hook original useLeads() continua funcionando sem alterações.
// ---------------------------------------------------------------------------

export interface UseLeadsPaginadosOptions {
  pageSize?: number;
  searchTerm?: string;
  statusFilter?: Lead["status"][];
  enabled?: boolean;
}

export function useLeadsPaginados(options: UseLeadsPaginadosOptions = {}) {
  const { pageSize = 20, searchTerm = "", statusFilter, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: ["leads-paginados", pageSize, searchTerm, statusFilter],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);

      if (searchTerm) {
        query = query.ilike("nome", `%${searchTerm}%`);
      }

      if (statusFilter && statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as Lead[], count: count ?? 0, page: pageParam };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0);
      return loaded < lastPage.count ? allPages.length : undefined;
    },
    initialPageParam: 0,
    enabled,
  });
}

// ---------------------------------------------------------------------------

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
          sobrenome: lead.sobrenome ?? null,
          email: lead.email,
          contato: lead.contato,
          origem: lead.origem,
          valor_estimado: lead.valor_estimado ?? null,
          responsavel_id: lead.responsavel_id ?? null,
          previsao_fechamento: lead.previsao_fechamento ?? null,
          empresa_lead: lead.empresa_lead ?? null,
          notas: lead.notas ?? null,
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

export type ConvertEnrichment = {
  cnpj: string | null;
  razao_social: string | null;
  endereco: string | null;
};

export const useConvertLeadToClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, enrichment }: { leadId: string; enrichment?: ConvertEnrichment | null }) => {
      const { data, error } = await supabase.rpc("rpc_converter_lead_cliente", {
        p_lead_id: leadId,
      });

      if (error) throw error;

      if (enrichment && data) {
        const updates: Record<string, unknown> = {};
        if (enrichment.cnpj) updates.cnpj = enrichment.cnpj;
        if (enrichment.razao_social) updates.nome = enrichment.razao_social;
        if (enrichment.endereco) updates.endereco = enrichment.endereco;
        if (Object.keys(updates).length > 0) {
          await supabase.from("clientes").update(updates).eq("id", data as string);
        }
      }

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

export const useUpdateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeadInsert> }) => {
      const { error } = await supabase.from("leads").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead atualizado");
    },
    onError: (err: unknown) => {
      toast.error("Erro ao atualizar", { description: getSafeErrorMessage(err) });
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

export interface LeadMember {
  id: string;
  first_name: string;
  last_name: string;
}

export const useLeadMembers = () => {
  return useQuery({
    queryKey: ["lead-members"],
    queryFn: async () => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("empresa_id", empresaId ?? "")
        .order("first_name");
      if (error) throw error;
      return (data || []) as LeadMember[];
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
