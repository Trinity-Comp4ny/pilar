import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { FINANCE_ITEMS_KEYS, type FinanceItemTipo } from "./useFinanceItems";

export function useFinanceItemMutations(tipo: FinanceItemTipo) {
  const qc = useQueryClient();
  const itemsKey = tipo === "despesa" ? FINANCE_ITEMS_KEYS.despesas : FINANCE_ITEMS_KEYS.receitas;
  const tableName = tipo === "despesa" ? "despesas" : "receitas";
  const labelSingular = tipo === "despesa" ? "Despesa" : "Receita";

  // ACH-CACHE-01: mudar uma receita/despesa (salvar, marcar recebida/pendente,
  // excluir) precisa invalidar não só a lista, mas todos os números derivados
  // (KPIs de topo, resumos, gráficos, dashboard) — senão o usuário vê valor
  // defasado até recarregar a página.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: itemsKey });
    qc.invalidateQueries({ queryKey: ["lancamentos-kpis"] });
    qc.invalidateQueries({ queryKey: ["finance-data"] });
    qc.invalidateQueries({ queryKey: ["dashboard-v2"] });
    qc.invalidateQueries({ queryKey: ["finance-chart-rpc"] });
    qc.invalidateQueries({ queryKey: ["finance-chart-fallback"] });
  };

  const marcarRecebida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("receitas")
        .update({ status: "Recebido", data_recebimento: format(new Date(), "yyyy-MM-dd") })
        .eq("id", id);
      if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));
    },
    onSuccess: () => {
      toast.success("Receita marcada como recebida");
      invalidate();
    },
    onError: (err) => {
      toast.error("Erro ao atualizar", { description: errorMessage(err, "Erro desconhecido") });
    },
  });

  const marcarPendente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("receitas")
        .update({ status: "Pendente", data_recebimento: null })
        .eq("id", id);
      if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));
    },
    onSuccess: () => {
      toast.success("Receita marcada como pendente");
      invalidate();
    },
    onError: (err) => {
      toast.error("Erro ao atualizar", { description: errorMessage(err, "Erro desconhecido") });
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete: marca deleted_at (as listas filtram is("deleted_at", null)).
      const { error } = await supabase.from(tableName).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));
    },
    onSuccess: () => {
      toast.success(`${labelSingular} excluída`);
      invalidate();
    },
    onError: (err) =>
      toast.error(`Falha ao excluir ${labelSingular.toLowerCase()}`, {
        description: errorMessage(err, "Tente novamente"),
      }),
  });

  const deleteGroup = useMutation({
    mutationFn: async ({ id, grupoId, mode }: { id: string; grupoId: string; mode: "single" | "all" }) => {
      // Soft-delete: marca deleted_at (as listas filtram is("deleted_at", null)).
      const deletedAt = new Date().toISOString();
      if (mode === "all") {
        const { error } = await supabase
          .from(tableName)
          .update({ deleted_at: deletedAt })
          .eq("grupo_parcela", grupoId)
          .is("deleted_at", null);
        if (error) throw error;
        return "all" as const;
      }
      const { error } = await supabase.from(tableName).update({ deleted_at: deletedAt }).eq("id", id);
      if (error) throw error;
      return "single" as const;
    },
    onSuccess: (mode) => {
      toast.success(mode === "all" ? "Grupo de parcelas excluído" : "Parcela excluída");
      invalidate();
    },
    onError: (err) =>
      toast.error("Falha ao excluir", {
        description: errorMessage(err, "Tente novamente"),
      }),
  });

  return { invalidate, deleteOne, deleteGroup, marcarRecebida, marcarPendente };
}
