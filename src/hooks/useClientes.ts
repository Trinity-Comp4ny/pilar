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

export interface ChavePix {
  chave: string;
  tipo: string;
}

export interface Cliente {
  id: string;
  nome: string;
  sobrenome?: string;
  cpf_cnpj: string;
  endereco: string;
  contato: string;
  email: string;
  tipo_nf?: string;
  origem?: string;
  contas_bancarias?: ContaBancaria[];
  chaves_pix?: ChavePix[];
}

export interface ClienteFormData {
  nome: string;
  sobrenome: string;
  cpf_cnpj: string;
  endereco: string;
  contato: string;
  email: string;
  tipo_nf: string;
  origem: string;
  contas_bancarias: ContaBancaria[];
  chaves_pix: ChavePix[];
}

export const useClientes = () => {
  const queryClient = useQueryClient();

  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");

      if (error) throw error;
      // Tipos gerados marcam campos opcionais como `string | null`, mas a interface
      // Cliente usa `string | undefined`. Cast via unknown evita atualizar todos
      // os consumidores neste momento.
      return (data ?? []) as unknown as Cliente[];
    },
    staleTime: 1000 * 60 * 3,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ClienteFormData }) => {
      const nullIfEmpty = (v: string) => v?.trim() || null;
      const payload = {
        nome: data.nome,
        sobrenome: data.sobrenome || null,
        cpf_cnpj: nullIfEmpty(data.cpf_cnpj),
        endereco: nullIfEmpty(data.endereco),
        contato: nullIfEmpty(data.contato),
        email: nullIfEmpty(data.email),
        tipo_nf: nullIfEmpty(data.tipo_nf),
        origem: nullIfEmpty(data.origem),
        contas_bancarias: data.contas_bancarias as unknown as Json,
        chaves_pix: data.chaves_pix as unknown as Json,
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
    onError: (error: unknown) => {
      const err = error as { code?: string; message?: string };
      if (err.code === "23505") {
        if (err.message?.includes("cpf_cnpj")) {
          toast.error("CPF/CNPJ já cadastrado", { description: "Este documento já pertence a outro cliente." });
        } else if (err.message?.includes("contato")) {
          toast.error("Contato já cadastrado", { description: "Este telefone já pertence a outro cliente." });
        } else if (err.message?.includes("email")) {
          toast.error("E-mail já cadastrado", { description: "Este e-mail já pertence a outro cliente." });
        } else {
          toast.error("Registro duplicado", { description: "Um dos campos já está em uso por outro cliente." });
        }
      } else {
        toast.error("Erro ao salvar", { description: err.message });
      }
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

  const portalClienteIdsQuery = useQuery({
    queryKey: ["portal-cliente-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("cliente_portal_accounts").select("cliente_id").eq("ativo", true);
      return new Set((data ?? []).map((r) => r.cliente_id as string));
    },
    staleTime: 1000 * 60 * 3,
  });

  const checkPortalAccess = async (clienteId: string) => {
    const { data } = await supabase
      .from("cliente_portal_accounts")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("ativo", true)
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

      return { email: data.email as string };
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar acesso");
    },
  });

  const resetPortalPasswordMutation = useMutation({
    mutationFn: async ({ clienteId, nomeCliente }: { clienteId: string; nomeCliente: string }) => {
      const { data, error: fnError } = await supabase.functions.invoke("reset-cliente-portal-password", {
        body: { cliente_id: clienteId, nome_cliente: nomeCliente },
      });

      if (fnError) {
        const body = fnError.context ? await fnError.context.json?.().catch(() => null) : null;
        throw new Error(body?.error || fnError.message || "Erro desconhecido");
      }
      if (data?.error) throw new Error(data.error);

      return { email: data.email as string };
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

  const revokePortalMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const { error } = await supabase
        .from("cliente_portal_accounts")
        .update({ ativo: false })
        .eq("cliente_id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso ao portal revogado");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao revogar acesso");
    },
  });

  return {
    clientes: clientesQuery.data ?? [],
    isLoading: clientesQuery.isLoading,
    portalClienteIds: portalClienteIdsQuery.data ?? new Set<string>(),
    upsertCliente: upsertMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    deleteCliente: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    checkPortalAccess,
    invitePortal: invitePortalMutation.mutateAsync,
    isInvitingPortal: invitePortalMutation.isPending,
    resetPortalPassword: resetPortalPasswordMutation.mutateAsync,
    isResettingPortal: resetPortalPasswordMutation.isPending,
    revokePortalAccess: revokePortalMutation.mutateAsync,
    isRevokingPortal: revokePortalMutation.isPending,
    fetchPortalEmail,
  };
};
