import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const despesasToInsert = buildDespesaPayloads({ formData, empresaId, selectedParcela: selected });

  if (selected) {
    const dataChanged = despesasToInsert[0].data_vencimento !== selected.data_vencimento;
    // Quando muda a data de uma despesa de cartão, desvincula a fatura para reassociação correta.
    const updatePayload =
      dataChanged && selected.cartao_id ? { ...despesasToInsert[0], fatura_id: null } : despesasToInsert[0];
    const { error } = await supabase.from("despesas").update(updatePayload).eq("id", selected.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("despesas").insert(despesasToInsert);
    if (error) throw error;
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
          toast.error("Erro ao associar fatura do cartão", { description: faturaError.message });
        }
      }
    }
  }

  return { numParcelas: despesasToInsert.length, isEdit: !!selected };
}

async function saveReceitaImpl({ formData, selected }: SaveReceitaArgs) {
  const empresaId = await getEmpresaId();
  const receitasToInsert = buildReceitaPayloads({ formData, empresaId, selectedParcela: selected });

  if (selected) {
    const { error } = await supabase.from("receitas").update(receitasToInsert[0]).eq("id", selected.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("receitas").insert(receitasToInsert);
    if (error) throw error;
  }

  return { numParcelas: receitasToInsert.length, isEdit: !!selected };
}

export function useFinanceItemMutations(tipo: FinanceItemTipo) {
  const qc = useQueryClient();
  const itemsKey = tipo === "despesa" ? FINANCE_ITEMS_KEYS.despesas : FINANCE_ITEMS_KEYS.receitas;
  const tableName = tipo === "despesa" ? "despesas" : "receitas";
  const labelSingular = tipo === "despesa" ? "Despesa" : "Receita";

  const invalidate = () => qc.invalidateQueries({ queryKey: itemsKey });

  const saveDespesa = useMutation({
    mutationFn: saveDespesaImpl,
    onSuccess: ({ numParcelas, isEdit }) => {
      toast.success(isEdit ? "Despesa atualizada" : "Despesa cadastrada", {
        description: isEdit ? "1 registro atualizado com sucesso" : `${numParcelas} registro(s) criado(s) com sucesso`,
      });
      invalidate();
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const saveReceita = useMutation({
    mutationFn: saveReceitaImpl,
    onSuccess: ({ numParcelas, isEdit }) => {
      toast.success(isEdit ? "Receita atualizada" : "Receita cadastrada", {
        description: isEdit ? "1 registro atualizado com sucesso" : `${numParcelas} registro(s) criado(s) com sucesso`,
      });
      invalidate();
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${labelSingular} excluída`);
      invalidate();
    },
    onError: (err) =>
      toast.error(`Falha ao excluir ${labelSingular.toLowerCase()}`, {
        description: err instanceof Error ? err.message : "Tente novamente",
      }),
  });

  const deleteGroup = useMutation({
    mutationFn: async ({ id, grupoId, mode }: { id: string; grupoId: string; mode: "single" | "all" }) => {
      const now = new Date().toISOString();
      if (mode === "all") {
        const { error } = await supabase
          .from(tableName)
          .update({ deleted_at: now })
          .eq("grupo_parcela", grupoId)
          .is("deleted_at", null);
        if (error) throw error;
        return "all" as const;
      }
      const { error } = await supabase.from(tableName).update({ deleted_at: now }).eq("id", id);
      if (error) throw error;
      return "single" as const;
    },
    onSuccess: (mode) => {
      toast.success(mode === "all" ? "Grupo de parcelas excluído" : "Parcela excluída");
      invalidate();
    },
    onError: (err) =>
      toast.error("Falha ao excluir", {
        description: err instanceof Error ? err.message : "Tente novamente",
      }),
  });

  return { saveDespesa, saveReceita, deleteOne, deleteGroup };
}
