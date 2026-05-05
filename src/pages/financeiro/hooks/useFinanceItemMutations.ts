import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths } from "date-fns";
import { toast } from "sonner";
import { parseCurrencyString } from "@/lib/currencyUtils";
import type { DespesaFormData } from "@/schemas/despesaSchema";
import type { ReceitaFormData } from "@/schemas/receitaSchema";
import { FINANCE_ITEMS_KEYS, type FinanceItemTipo, type DespesaItem, type ReceitaItem } from "./useFinanceItems";

interface SaveDespesaArgs {
  formData: DespesaFormData;
  selected: DespesaItem | null;
  cartoes: { id: string; dia_fechamento: number | null }[];
}

interface SaveReceitaArgs {
  formData: ReceitaFormData;
  selected: ReceitaItem | null;
}

async function saveDespesaImpl({ formData, selected, cartoes }: SaveDespesaArgs) {
  const numParcelas = parseInt(formData.parcelas) || 1;
  const valorNumerico = parseCurrencyString(formData.valorTotal);
  const valorParcela = Math.round((valorNumerico / numParcelas) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
  if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

  const grupoParcela = numParcelas > 1 ? crypto.randomUUID() : null;
  const despesasToInsert: Array<Record<string, unknown>> = [];
  const initialDate = new Date(formData.dataVencimento);

  for (let i = 0; i < numParcelas; i++) {
    const dataParcela = addMonths(initialDate, i);
    const dataStr = format(dataParcela, "yyyy-MM-dd");
    const isUltima = i === numParcelas - 1 && numParcelas > 1;
    const valorFinal = isUltima
      ? Math.round((valorNumerico - valorParcela * (numParcelas - 1)) * 100) / 100
      : valorParcela;

    despesasToInsert.push({
      data_vencimento: dataStr,
      data_pagamento: formData.status === "Pago" ? dataStr : null,
      descricao: numParcelas > 1 ? `${formData.descricao} (${i + 1}/${numParcelas})` : formData.descricao,
      categoria_id: formData.categoriaId || null,
      valor: valorFinal,
      fornecedor_id: formData.fornecedorId || null,
      projeto_id: formData.projetoID || null,
      nota_fiscal: formData.notaFiscal || null,
      status: formData.status === "Pago" ? "Pago" : "Pendente",
      conta_id: formData.contaId || null,
      cartao_id: formData.cartaoId || null,
      observacao: formData.observacao || null,
      recorrente: formData.recorrente || false,
      periodicidade: formData.recorrente ? formData.periodicidade || "mensal" : null,
      empresa_id: empresaId,
      grupo_parcela: selected ? (selected.grupo_parcela ?? null) : grupoParcela,
      parcela_numero: selected ? (selected.parcela_numero ?? null) : numParcelas > 1 ? i + 1 : null,
      parcela_total: selected ? (selected.parcela_total ?? null) : numParcelas > 1 ? numParcelas : null,
    });
  }

  if (selected) {
    const dataChanged = despesasToInsert[0].data_vencimento !== selected.data_vencimento;
    const updatePayload =
      dataChanged && selected.cartao_id ? { ...despesasToInsert[0], fatura_id: null } : despesasToInsert[0];
    const { error } = await supabase
      .from("despesas")
      .update(updatePayload as never)
      .eq("id", selected.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("despesas").insert(despesasToInsert as never[]);
    if (error) throw error;
  }

  if (formData.cartaoId) {
    const card = cartoes.find((c) => c.id === formData.cartaoId);
    const diaFechamento = card?.dia_fechamento ?? 31;
    const mesesGerados = new Set<string>();

    for (const d of despesasToInsert) {
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

  return { numParcelas, isEdit: !!selected };
}

async function saveReceitaImpl({ formData, selected }: SaveReceitaArgs) {
  const numParcelas = parseInt(formData.parcelas) || 1;
  const valorNumerico = parseCurrencyString(formData.valorTotal);
  const valorParcela = Math.round((valorNumerico / numParcelas) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
  if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

  const grupoParcela = numParcelas > 1 ? crypto.randomUUID() : null;
  const receitasToInsert: Array<Record<string, unknown>> = [];

  for (let i = 0; i < numParcelas; i++) {
    const dataParcela = addMonths(formData.dataVencimento, i);
    const dataStr = format(dataParcela, "yyyy-MM-dd");
    const isUltima = i === numParcelas - 1 && numParcelas > 1;
    const valorFinal = isUltima
      ? Math.round((valorNumerico - valorParcela * (numParcelas - 1)) * 100) / 100
      : valorParcela;

    receitasToInsert.push({
      data_vencimento: dataStr,
      data_recebimento: formData.status === "Recebida" ? dataStr : null,
      descricao: numParcelas > 1 ? `${formData.descricao} (${i + 1}/${numParcelas})` : formData.descricao,
      projeto_id: formData.projetoID || null,
      categoria_id: formData.categoriaId || null,
      valor: valorFinal,
      forma_pagamento: formData.formaPagamento || null,
      nota_fiscal: formData.notaFiscal || null,
      status: formData.status === "Recebida" ? "Recebido" : "Pendente",
      conta_id: formData.contaId || null,
      cliente_id: formData.clienteId || null,
      observacao: formData.observacao || null,
      empresa_id: empresaId,
      grupo_parcela: selected ? (selected.grupo_parcela ?? null) : grupoParcela,
      parcela_numero: selected ? (selected.parcela_numero ?? null) : numParcelas > 1 ? i + 1 : null,
      parcela_total: selected ? (selected.parcela_total ?? null) : numParcelas > 1 ? numParcelas : null,
    });
  }

  if (selected) {
    const { error } = await supabase
      .from("receitas")
      .update(receitasToInsert[0] as never)
      .eq("id", selected.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("receitas").insert(receitasToInsert as never[]);
    if (error) throw error;
  }

  return { numParcelas, isEdit: !!selected };
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
