import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { PagoPor } from "@/lib/obras";
import { softDelete } from "@/lib/softDelete";

export type ObraLancamentoRow = Tables<"obra_conta_lancamento">;

const contaKey = (obraId: string) => ["obra_conta", obraId] as const;

/**
 * A taxa de administração cria/edita uma receita no financeiro do escritório
 * (ADR 0013). Ao mexer numa despesa, invalidar também as views que somam receita:
 * lista financeira, dashboard e a margem/rentabilidade do projeto.
 */
function invalidarFinancas(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["finance-items"] });
  qc.invalidateQueries({ queryKey: ["finance-data"] });
  qc.invalidateQueries({ queryKey: ["dashboard-rentabilidade"] });
  qc.invalidateQueries({ queryKey: ["projeto-rentabilidade"] });
}

/** Lançamentos da conta da obra (aportes + despesas), mais recentes primeiro. */
export function useObraConta(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_conta", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ObraLancamentoRow[]> => {
      const { data, error } = await supabase
        .from("obra_conta_lancamento")
        .select("*")
        .eq("obra_id", obraId!)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Aporte do cliente: entrada simples, sem taxa nem efeito no financeiro do escritório. */
export function useSaveAporte(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      descricao,
      valor,
    }: {
      data: string;
      descricao: string;
      valor: number;
    }): Promise<void> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { error } = await supabase.from("obra_conta_lancamento").insert({
        empresa_id: empresaId,
        obra_id: obraId,
        tipo: "aporte",
        data,
        descricao,
        valor,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contaKey(obraId) }),
  });
}

export type DespesaInput = {
  id?: string | null;
  data: string;
  descricao: string;
  valor: number;
  obra_frente_id?: string | null;
  fornecedor_id?: string | null;
  pago_por?: PagoPor;
  comprovante_url?: string | null;
  /** false = segurada (em conferência), não aparece no portal do cliente. Default true. */
  confirmada_portal?: boolean;
};

/**
 * Despesa paga com o dinheiro da obra. Via RPC transacional: grava o lançamento e
 * cria/atualiza a receita de taxa de administração de forma idempotente (ADR 0013).
 */
export function useSaveDespesa(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DespesaInput): Promise<void> => {
      const { error } = await supabase.rpc("rpc_obra_despesa_salvar", {
        p_obra_id: obraId,
        p_data: input.data,
        p_descricao: input.descricao,
        p_valor: input.valor,
        p_id: input.id ?? undefined,
        p_obra_frente_id: input.obra_frente_id ?? undefined,
        p_fornecedor_id: input.fornecedor_id ?? undefined,
        p_pago_por: input.pago_por ?? "cliente",
        p_comprovante_url: input.comprovante_url ?? undefined,
        p_confirmada_portal: input.confirmada_portal ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contaKey(obraId) });
      invalidarFinancas(qc);
    },
  });
}

/**
 * Remove um lançamento. Despesa vai pelo RPC (soft delete + estorna a taxa);
 * aporte é soft delete direto (não tem efeito no financeiro do escritório).
 */
export function useDeleteLancamento(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: string }): Promise<void> => {
      if (tipo === "despesa") {
        const { error } = await supabase.rpc("rpc_obra_despesa_excluir", { p_id: id });
        if (error) throw error;
        return;
      }
      // Via RPC: a policy de SELECT esconde deletado, então UPDATE direto leva 42501.
      const error = await softDelete("obra_conta_lancamento", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contaKey(obraId) });
      invalidarFinancas(qc);
    },
  });
}
