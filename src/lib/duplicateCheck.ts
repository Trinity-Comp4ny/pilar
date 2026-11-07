import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/** Quão forte é o indício de duplicata (regra em rpc_buscar_duplicatas). */
export type ConfiancaDuplicata = "certeza" | "alta" | "media";

export interface DuplicateMatch {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string | null;
  status: string | null;
  contraparte_nome: string | null;
  nota_fiscal: string | null;
  confianca: ConfiancaDuplicata;
  motivo: string;
}

interface DuplicateCheckParams {
  table: "receitas" | "despesas";
  descricao: string;
  valor: number;
  dataVencimento: Date;
  /** Cliente (receita) ou fornecedor (despesa). Com ele, mesmo valor + data vira "alta". */
  contraparteId?: string | null;
  /** Mesma NF + mesma contraparte é "certeza". */
  notaFiscal?: string | null;
  /** Edição: o próprio lançamento não é duplicata dele mesmo. */
  excludeId?: string;
  /** Parcelas do mesmo grupo nunca são duplicata entre si. */
  grupoParcela?: string | null;
}

/**
 * Procura lançamentos que podem ser o mesmo que está sendo gravado. A regra vive no
 * servidor (rpc_buscar_duplicatas, SPEC 149 fase 2) para valer igual em todo caminho
 * de entrada: nota fiscal, contraparte + valor + data, e descrição parecida (pg_trgm)
 * em vez de idêntica. Falha de rede não bloqueia o salvamento: devolve lista vazia.
 */
export async function checkDuplicates({
  table,
  descricao,
  valor,
  dataVencimento,
  contraparteId,
  notaFiscal,
  excludeId,
  grupoParcela,
}: DuplicateCheckParams): Promise<DuplicateMatch[]> {
  const { data, error } = await supabase.rpc("rpc_buscar_duplicatas", {
    p_tipo: table === "receitas" ? "receita" : "despesa",
    p_valor: valor,
    p_data: format(dataVencimento, "yyyy-MM-dd"),
    p_descricao: descricao,
    p_contraparte_id: contraparteId || undefined,
    p_nota_fiscal: notaFiscal || undefined,
    p_excluir_id: excludeId,
    p_grupo_parcela: grupoParcela || undefined,
  });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((d) => ({
    id: String(d.id),
    descricao: String(d.descricao ?? ""),
    valor: Number(d.valor ?? 0),
    data_vencimento: (d.data_vencimento as string | null) ?? null,
    status: (d.status as string | null) ?? null,
    contraparte_nome: (d.contraparte_nome as string | null) ?? null,
    nota_fiscal: (d.nota_fiscal as string | null) ?? null,
    confianca: (d.confianca as ConfiancaDuplicata) ?? "media",
    motivo: String(d.motivo ?? ""),
  }));
}
