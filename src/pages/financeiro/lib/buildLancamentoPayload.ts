import { format, addMonths } from "date-fns";
import { parseCurrencyString } from "@/lib/currencyUtils";
import type { Database } from "@/integrations/supabase/types";
import type { DespesaFormData } from "@/schemas/despesaSchema";
import type { ReceitaFormData } from "@/schemas/receitaSchema";

type DespesaInsert = Database["public"]["Tables"]["despesas"]["Insert"];
type ReceitaInsert = Database["public"]["Tables"]["receitas"]["Insert"];

interface ParcelaContext {
  /** grupo_parcela do registro existente (edit) ou recém-gerado (insert) */
  grupoParcela: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
}

interface SelectedParcelaSource {
  grupo_parcela?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
}

interface BaseBuilderArgs {
  empresaId: string;
}

interface BuildDespesasArgs extends BaseBuilderArgs {
  formData: DespesaFormData;
  /** Se editando, herda grupo/parcela do registro existente */
  selectedParcela?: SelectedParcelaSource | null;
}

interface BuildReceitasArgs extends BaseBuilderArgs {
  formData: ReceitaFormData;
  selectedParcela?: SelectedParcelaSource | null;
}

/** Distribui um valor total em N parcelas, com a última absorvendo arredondamento. */
export function calcParcelas(valorTotal: number, numParcelas: number): number[] {
  const valorParcela = Math.round((valorTotal / numParcelas) * 100) / 100;
  return Array.from({ length: numParcelas }, (_, i) => {
    const isUltima = i === numParcelas - 1 && numParcelas > 1;
    return isUltima ? Math.round((valorTotal - valorParcela * (numParcelas - 1)) * 100) / 100 : valorParcela;
  });
}

/** Gera contexto de parcela para cada índice, respeitando edição (selected). */
function parcelaContext(
  index: number,
  numParcelas: number,
  novoGrupo: string | null,
  selected: SelectedParcelaSource | null | undefined
): ParcelaContext {
  if (selected) {
    return {
      grupoParcela: selected.grupo_parcela ?? null,
      parcelaNumero: selected.parcela_numero ?? null,
      parcelaTotal: selected.parcela_total ?? null,
    };
  }
  return {
    grupoParcela: novoGrupo,
    parcelaNumero: numParcelas > 1 ? index + 1 : null,
    parcelaTotal: numParcelas > 1 ? numParcelas : null,
  };
}

function descricaoParcelada(descricao: string, index: number, numParcelas: number): string {
  return numParcelas > 1 ? `${descricao} (${index + 1}/${numParcelas})` : descricao;
}

export function buildDespesaPayloads({ formData, empresaId, selectedParcela }: BuildDespesasArgs): DespesaInsert[] {
  const numParcelas = parseInt(formData.parcelas) || 1;
  const valorNumerico = parseCurrencyString(formData.valorTotal);
  const valores = calcParcelas(valorNumerico, numParcelas);
  const novoGrupo = numParcelas > 1 ? crypto.randomUUID() : null;
  const initialDate = new Date(formData.dataVencimento);
  const isPago = formData.status === "Pago";

  return Array.from({ length: numParcelas }, (_, i) => {
    const dataStr = format(addMonths(initialDate, i), "yyyy-MM-dd");
    const ctx = parcelaContext(i, numParcelas, novoGrupo, selectedParcela);

    return {
      data_vencimento: dataStr,
      data_pagamento: isPago ? dataStr : null,
      descricao: descricaoParcelada(formData.descricao, i, numParcelas),
      categoria_id: formData.categoriaId || null,
      valor: valores[i],
      fornecedor_id: formData.fornecedorId || null,
      projeto_id: formData.projetoID || null,
      nota_fiscal: formData.notaFiscal || null,
      status: isPago ? "Pago" : "Pendente",
      conta_id: formData.contaId || null,
      cartao_id: formData.cartaoId || null,
      observacao: formData.observacao || null,
      recorrente: formData.recorrente || false,
      periodicidade: formData.recorrente ? formData.periodicidade || "mensal" : null,
      empresa_id: empresaId,
      grupo_parcela: ctx.grupoParcela,
      parcela_numero: ctx.parcelaNumero,
      parcela_total: ctx.parcelaTotal,
    } satisfies DespesaInsert;
  });
}

export function buildReceitaPayloads({ formData, empresaId, selectedParcela }: BuildReceitasArgs): ReceitaInsert[] {
  const numParcelas = parseInt(formData.parcelas) || 1;
  const valorNumerico = parseCurrencyString(formData.valorTotal);
  const valores = calcParcelas(valorNumerico, numParcelas);
  const novoGrupo = numParcelas > 1 ? crypto.randomUUID() : null;
  const isRecebida = formData.status === "Recebida";

  return Array.from({ length: numParcelas }, (_, i) => {
    const dataStr = format(addMonths(formData.dataVencimento, i), "yyyy-MM-dd");
    const ctx = parcelaContext(i, numParcelas, novoGrupo, selectedParcela);

    return {
      data_vencimento: dataStr,
      data_recebimento: isRecebida ? dataStr : null,
      descricao: descricaoParcelada(formData.descricao, i, numParcelas),
      projeto_id: formData.projetoID || null,
      categoria_id: formData.categoriaId || null,
      valor: valores[i],
      forma_pagamento: formData.formaPagamento || null,
      nota_fiscal: formData.notaFiscal || null,
      status: isRecebida ? "Recebido" : "Pendente",
      conta_id: formData.contaId || null,
      cliente_id: formData.clienteId || null,
      observacao: formData.observacao || null,
      empresa_id: empresaId,
      grupo_parcela: ctx.grupoParcela,
      parcela_numero: ctx.parcelaNumero,
      parcela_total: ctx.parcelaTotal,
    } satisfies ReceitaInsert;
  });
}
