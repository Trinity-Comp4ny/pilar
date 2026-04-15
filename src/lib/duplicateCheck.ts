import { supabase } from "@/integrations/supabase/client";
import { format, addDays, subDays } from "date-fns";

export interface DuplicateMatch {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
}

interface DuplicateCheckParams {
  table: "receitas" | "despesas";
  descricao: string;
  valor: number;
  dataVencimento: Date;
  excludeId?: string;
}

/**
 * Remove sufixos de parcela "(1/3)" da descrição para comparação
 */
function stripParcelaSuffix(desc: string): string {
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

const IGNORED_STATUSES = ["Cancelado"];
const VALUE_TOLERANCE = 0.01; // 1%

/**
 * Verifica se existem lançamentos similares que podem ser duplicatas.
 * Critérios: mesma descrição (sem sufixo parcela) + valor ±1% + data ±5 dias.
 * Ignora registros soft-deleted e com status "Cancelado".
 */
export async function checkDuplicates({
  table,
  descricao,
  valor,
  dataVencimento,
  excludeId,
}: DuplicateCheckParams): Promise<DuplicateMatch[]> {
  const baseDesc = stripParcelaSuffix(descricao);
  const dateFrom = format(subDays(dataVencimento, 5), "yyyy-MM-dd");
  const dateTo = format(addDays(dataVencimento, 5), "yyyy-MM-dd");
  const valorMin = valor * (1 - VALUE_TOLERANCE);
  const valorMax = valor * (1 + VALUE_TOLERANCE);

  let query = supabase
    .from(table)
    .select("id, descricao, valor, data_vencimento, status")
    .is("deleted_at", null)
    .not("status", "in", `(${IGNORED_STATUSES.join(",")})`)
    .gte("data_vencimento", dateFrom)
    .lte("data_vencimento", dateTo)
    .gte("valor", valorMin)
    .lte("valor", valorMax);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.filter((item) => {
    const itemBase = stripParcelaSuffix(item.descricao).toLowerCase();
    return itemBase === baseDesc.toLowerCase();
  });
}
