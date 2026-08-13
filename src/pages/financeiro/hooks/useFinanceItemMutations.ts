import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { getSafeErrorMessage } from "@/lib/safeError";
import type { DespesaFormData } from "@/schemas/despesaSchema";
import type { ReceitaFormData } from "@/schemas/receitaSchema";
import { FINANCE_ITEMS_KEYS, type FinanceItemTipo, type DespesaItem, type ReceitaItem } from "./useFinanceItems";
import { buildDespesaPayloads, buildReceitaPayloads } from "../lib/buildLancamentoPayload";

interface SaveDespesaArgs {
  formData: DespesaFormData;
  selected: DespesaItem | null;
  cartoes: { id: string; dia_fechamento: number | null }[];
}

interface SaveReceitaArgs {
  formData: ReceitaFormData;
  selected: ReceitaItem | null;
}

async function getEmpresaId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
  if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
  return empresaId;
}

async function saveDespesaImpl({ formData, selected, cartoes }: SaveDespesaArgs) {
  const empresaId = await getEmpresaId();
  // Na edição só existe UMA parcela em jogo (a selecionada). Força parcelas=1 para
  // gravar o valor cheio do formulário, não o rateio, e não gerar payloads extras
  // que seriam silenciosamente descartados (só o [0] era usado no update).
  const despesasToInsert = buildDespesaPayloads({
    formData: selected ? { ...formData, parcelas: "1" } : formData,
    empresaId,
    selectedParcela: selected,
  });

  if (selected) {
    const dataChanged = despesasToInsert[0].data_vencimento !== selected.data_vencimento;
    // Quando muda a data de uma despesa de cartão, desvincula a fatura para reassociação correta.
    const updatePayload =
      dataChanged && selected.cartao_id ? { ...despesasToInsert[0], fatura_id: null } : despesasToInsert[0];
    const { error } = await supabase.from("despesas").update(updatePayload).eq("id", selected.id);
    if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));
  } else {
    const { error } = await supabase.from("despesas").insert(despesasToInsert);
    if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));
  }

  if (formData.cartaoId) {
    const card = cartoes.find((c) => c.id === formData.cartaoId);
    const diaFechamento = card?.dia_fechamento ?? 31;
    const mesesGerados = new Set<string>();

    for (const d of despesasToInsert) {
      if (!d.data_vencimento) continue;
      const dt = new Date(d.data_vencimento + "T00:00:00");
      let billingMonth = dt.getMonth() + 1;
      let billingYear = dt.getFullYear();
      if (dt.getDate() > diaFechamento) {
        billingMonth++;
        if (billingMonth > 12) {
          billingMonth = 1;
          billingYear++;
        }
      }
      const key = `${billingMonth}-${billingYear}`;
      if (!mesesGerados.has(key)) {
        mesesGerados.add(key);
        const { error: faturaError } = await supabase.rpc("gerar_fatura", {
          p_cartao_id: formData.cartaoId,
          p_mes: billingMonth,
          p_ano: billingYear,
        });
        if (faturaError) {
          toast.error("Não foi possível associar a fatura do cartão", {
            description: getSafeErrorMessage(faturaError, "A despesa foi salva. Tente associar de novo em instantes."),
          });
        }
      }
    }
  }

  return { numParcelas: despesasToInsert.length, isEdit: !!selected };
}

async function saveReceitaImpl({ formData, selected }: SaveReceitaArgs) {
  const empresaId = await getEmpresaId();
  // Na edição só existe UMA parcela em jogo (a selecionada). Força parcelas=1 para
  // gravar o valor cheio do formulário, não o rateio, e não gerar payloads extras
  // que seriam silenciosamente descartados (só o [0] era usado no update).
  const receitasToInsert = buildReceitaPayloads({
    formData: selected ? { ...formData, parcelas: "1" } : formData,
    empresaId,
    selectedParcela: selected,
  });

  if (selected) {
    const { error } = await supabase.from("receitas").update(receitasToInsert[0]).eq("id", selected.id);
    if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));
  } else {
    const { error } = await supabase.from("receitas").insert(receitasToInsert);
    if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));
  }

  return { numParcelas: receitasToInsert.length, isEdit: !!selected };
}

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

  const saveDespesa = useMutation({
    mutationFn: saveDespesaImpl,
    onSuccess: ({ numParcelas, isEdit }) => {
      toast.success(isEdit ? "Despesa atualizada" : "Despesa cadastrada", {
        description: isEdit ? "1 registro atualizado com sucesso" : `${numParcelas} registro(s) criado(s) com sucesso`,
      });
      invalidate();
    },
    onError: (err) => {
      toast.error("Erro ao salvar despesa", { description: errorMessage(err, "Erro ao salvar") });
    },
  });

  const saveReceita = useMutation({
    mutationFn: saveReceitaImpl,
    onSuccess: ({ numParcelas, isEdit }) => {
      toast.success(isEdit ? "Receita atualizada" : "Receita cadastrada", {
        description: isEdit ? "1 registro atualizado com sucesso" : `${numParcelas} registro(s) criado(s) com sucesso`,
      });
      invalidate();
    },
    onError: (err) => {
      toast.error("Erro ao salvar receita", { description: errorMessage(err, "Erro ao salvar") });
    },
  });

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
      const { error } = await supabase
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
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

  return { saveDespesa, saveReceita, deleteOne, deleteGroup, marcarRecebida, marcarPendente };
}
