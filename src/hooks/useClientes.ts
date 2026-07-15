import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { onlyDigits } from "@/lib/maskUtils";
import { errorMessage } from "@/lib/errors";

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

export type TipoPessoa = "PF" | "PJ";

export interface Cliente {
  id: string;
  nome: string;
  sobrenome?: string;
  tipo_pessoa?: TipoPessoa | null;
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
  tipo_pessoa: TipoPessoa;
  cpf_cnpj: string;
  endereco: string;
  contato: string;
  email: string;
  tipo_nf: string;
  origem: string;
  contas_bancarias: ContaBancaria[];
  chaves_pix: ChavePix[];
}

// ---------------------------------------------------------------------------
// Hook paginado — paginação REAL no servidor via RPC listar_clientes_paginado.
// Filtros (busca, origem, tipo PF/PJ, com/sem portal, com/sem projeto),
// ordenação e limit/offset rodam no Postgres, escopados por empresa (RLS).
// O hook original useClientes() continua disponível para mutations e para
// consumidores que ainda precisam da lista completa.
// ---------------------------------------------------------------------------

export type ClienteSortField = "nome" | "cpf_cnpj" | "created_at";

// "all" -> todos; "com"/"sem" -> filtro booleano no servidor.
export type FiltroTriplo = "all" | "com" | "sem";

export interface UseClientesPaginadosOptions {
  page?: number; // 0-based
  pageSize?: number;
  search?: string;
  origem?: string; // "all" ou o valor da origem
  tipoPessoa?: string; // "all" | "PF" | "PJ"
  portal?: FiltroTriplo;
  projeto?: FiltroTriplo;
  sortField?: ClienteSortField;
  sortDir?: "asc" | "desc";
  enabled?: boolean;
}

const triploToBool = (v: FiltroTriplo | undefined): boolean | null =>
  v === "com" ? true : v === "sem" ? false : null;

export function useClientesPaginados(options: UseClientesPaginadosOptions = {}) {
  const {
    page = 0,
    pageSize = 20,
    search = "",
    origem = "all",
    tipoPessoa = "all",
    portal = "all",
    projeto = "all",
    sortField = "nome",
    sortDir = "asc",
    enabled = true,
  } = options;

  const query = useQuery({
    // Prefixo ["clientes"] para que as invalidações das mutations (upsert/delete/
    // restore, que invalidam ["clientes"]) também atualizem esta lista.
    queryKey: [
      "clientes",
      "lista",
      { page, pageSize, search, origem, tipoPessoa, portal, projeto, sortField, sortDir },
    ],
    queryFn: async () => {
      // RPC ainda não está em types.ts (rodar gen:types após deploy da migration).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("listar_clientes_paginado", {
        p_search: search.trim() || null,
        p_origem: origem === "all" ? null : origem,
        p_tipo_pessoa: tipoPessoa === "all" ? null : tipoPessoa,
        p_tem_portal: triploToBool(portal),
        p_com_projeto: triploToBool(projeto),
        p_sort_field: sortField,
        p_sort_dir: sortDir,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      if (error) throw error;

      const rows = (data ?? []) as (Cliente & { total_count: number })[];
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      // Remove total_count de cada linha para expor Cliente puro.
      const clientes = rows.map(({ total_count: _tc, ...c }) => c as Cliente);
      return { clientes, total };
    },
    enabled,
    // Mantém a página anterior visível durante a troca de página/filtro,
    // evitando o flash de skeleton a cada navegação.
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 3,
  });

  return {
    clientes: query.data?.clientes ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// Origens distintas (para o filtro), via RPC — sem baixar a lista inteira.
export function useOrigensClientes(enabled = true) {
  return useQuery({
    queryKey: ["clientes", "origens"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("listar_origens_clientes");
      if (error) throw error;
      return ((data ?? []) as { origem: string }[]).map((r) => r.origem);
    },
    enabled,
    staleTime: 1000 * 60 * 3,
  });
}

// ---------------------------------------------------------------------------

export interface UseClientesOptions {
  // Quando false, não dispara as consultas que baixam a lista completa e os
  // conjuntos auxiliares (portal/projeto). A lista de Clientes usa a paginação
  // server-side e só precisa das mutations deste hook.
  enableListQueries?: boolean;
}

export const useClientes = (options: UseClientesOptions = {}) => {
  const { enableListQueries = true } = options;
  const queryClient = useQueryClient();

  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .is("deleted_at", null)
        .order("nome");

      if (error) throw error;
      // Tipos gerados marcam campos opcionais como `string | null`, mas a interface
      // Cliente usa `string | undefined`. Cast via unknown evita atualizar todos
      // os consumidores neste momento.
      return (data ?? []) as unknown as Cliente[];
    },
    enabled: enableListQueries,
    staleTime: 1000 * 60 * 3,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ClienteFormData }) => {
      const nullIfEmpty = (v: string) => v?.trim() || null;
      // Persistir só dígitos: a máscara é aplicada só na exibição. Assim a
      // unicidade por empresa e a deduplicação não dependem da formatação.
      const cpfCnpjDigits = onlyDigits(data.cpf_cnpj);
      const payload = {
        nome: data.nome,
        sobrenome: data.sobrenome || null,
        // tipo_pessoa é coluna nova, ainda fora dos tipos gerados: ver cast abaixo.
        tipo_pessoa: data.tipo_pessoa || null,
        cpf_cnpj: cpfCnpjDigits || null,
        endereco: nullIfEmpty(data.endereco),
        contato: nullIfEmpty(data.contato),
        email: nullIfEmpty(data.email),
        tipo_nf: nullIfEmpty(data.tipo_nf),
        origem: nullIfEmpty(data.origem),
        contas_bancarias: data.contas_bancarias as unknown as Json,
        chaves_pix: data.chaves_pix as unknown as Json,
      };

      // tipo_pessoa ainda não está em types.ts (rodar gen:types após deploy da
      // migration). Cast para evitar o erro de tipo até lá.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientesTable = supabase.from("clientes") as any;

      if (id) {
        const { error } = await clientesTable.update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data: empresaData } = await supabase.rpc("get_user_empresa_id");
        const { error } = await clientesTable.insert({
          ...payload,
          empresa_id: empresaData as string,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      // Página de detalhe usa ["cliente", id]: invalida para refletir a edição.
      queryClient.invalidateQueries({ queryKey: ["cliente"] });
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

  // Restaura um cliente soft-deletado (usado pelo "Desfazer" do toast).
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente restaurado");
    },
    onError: (error: unknown) => {
      toast.error("Erro ao restaurar", { description: errorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    // Soft delete: preserva receitas/propostas/leads históricos (FK ON DELETE
    // SET NULL orfanaria esses registros num hard delete).
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clientes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente excluído", {
        action: {
          label: "Desfazer",
          onClick: () => restoreMutation.mutate(id),
        },
      });
    },
    onError: (error: unknown) => {
      toast.error("Erro ao excluir", { description: errorMessage(error) });
    },
  });

  const portalClienteIdsQuery = useQuery({
    queryKey: ["portal-cliente-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("cliente_portal_accounts").select("cliente_id").eq("ativo", true);
      return new Set((data ?? []).map((r) => r.cliente_id as string));
    },
    enabled: enableListQueries,
    staleTime: 1000 * 60 * 3,
  });

  // Ids de clientes que têm ao menos um projeto ativo (para o filtro com/sem projeto).
  const clienteIdsComProjetoQuery = useQuery({
    queryKey: ["cliente-ids-com-projeto"],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("cliente_id").is("deleted_at", null);
      return new Set((data ?? []).map((r) => r.cliente_id).filter(Boolean) as string[]);
    },
    enabled: enableListQueries,
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
    isError: clientesQuery.isError,
    refetch: clientesQuery.refetch,
    portalClienteIds: portalClienteIdsQuery.data ?? new Set<string>(),
    clienteIdsComProjeto: clienteIdsComProjetoQuery.data ?? new Set<string>(),
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
