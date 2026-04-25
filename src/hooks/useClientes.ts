import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface ContaBancaria {
  banco: string;
  agencia: string;
  conta: string;
  tipo: string;
  is_primary?: boolean;
  [key: string]: Json | undefined;
}

export interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  endereco: string;
  contato: string;
  email: string;
  tipo_nf?: string;
  origem?: string;
  contas_bancarias?: ContaBancaria[];
}

export interface ClienteFormData {
  nome: string;
  cpf_cnpj: string;
  endereco: string;
  contato: string;
  email: string;
  tipo_nf: string;
  origem: string;
  contas_bancarias: ContaBancaria[];
}

export const useClientes = () => {
  const queryClient = useQueryClient();

  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");

      if (error) throw error;
      return (data ?? []) as unknown as Cliente[];
    },
    staleTime: 1000 * 60 * 3,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ClienteFormData }) => {
      const payload = {
        nome: data.nome,
        cpf_cnpj: data.cpf_cnpj,
        endereco: data.endereco,
        contato: data.contato,
        email: data.email,
        tipo_nf: data.tipo_nf,
        origem: data.origem,
        contas_bancarias: data.contas_bancarias as unknown as Json,
      };

      if (id) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data: empresaData } = await supabase.rpc("get_user_empresa_id");
        const { error } = await supabase.from("clientes").insert({
          ...payload,
          empresa_id: empresaData as string,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(variables.id ? "Cliente atualizado" : "Cliente cadastrado", {
        description: variables.id
          ? "Dados do cliente atualizados com sucesso"
          : "Novo cliente foi adicionado com sucesso",
      });
    },
    onError: () => {
      toast.error("Erro ao salvar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente excluído");
    },
    onError: () => {
      toast.error("Erro ao excluir", {
        description: "Verifique se existem registros vinculados.",
      });
    },
  });

  const checkPortalAccess = async (clienteId: string) => {
    const { data } = await supabase
      .from("cliente_portal_accounts")
      .select("id")
      .eq("cliente_id", clienteId)
      .maybeSingle();

    return !!data;
  };

  const invitePortalMutation = useMutation({
    mutationFn: async ({ clienteId, email }: { clienteId: string; email: string }) => {
      const { data, error: fnError } = await supabase.functions.invoke("invite-cliente-portal", {
        body: { cliente_id: clienteId, email },
      });

      if (fnError) {
        const body = fnError.context ? await fnError.context.json?.().catch(() => null) : null;
        throw new Error(body?.error || fnError.message || "Erro desconhecido");
      }
      if (data?.error) throw new Error(data.error);

      return { email: data.email as string, senha: data.senha as string };
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar acesso");
    },
  });

  const resetPortalPasswordMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const { data, error: fnError } = await supabase.functions.invoke("reset-cliente-portal-password", {
        body: { cliente_id: clienteId },
      });

      if (fnError) {
        const body = fnError.context ? await fnError.context.json?.().catch(() => null) : null;
        throw new Error(body?.error || fnError.message || "Erro desconhecido");
      }
      if (data?.error) throw new Error(data.error);

      return { email: data.email as string, senha: data.senha as string };
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao redefinir senha");
    },
  });

  const fetchPortalEmail = async (clienteId: string) => {
    const { data } = await supabase
      .from("cliente_portal_accounts")
      .select("email")
      .eq("cliente_id", clienteId)
      .maybeSingle();

    return data?.email ?? null;
  };

  return {
    clientes: clientesQuery.data ?? [],
    isLoading: clientesQuery.isLoading,
    upsertCliente: upsertMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    deleteCliente: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    checkPortalAccess,
    invitePortal: invitePortalMutation.mutateAsync,
    isInvitingPortal: invitePortalMutation.isPending,
    resetPortalPassword: resetPortalPasswordMutation.mutateAsync,
    isResettingPortal: resetPortalPasswordMutation.isPending,
    fetchPortalEmail,
  };
};
