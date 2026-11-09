import { supabase } from "@/integrations/supabase/client";
import { softDelete } from "@/lib/softDelete";
import type { Lancamento } from "../hooks/useLancamentosUnified";

export type ResultadoExclusao = {
  /** Linhas que o banco de fato removeu. */
  excluidos: number;
  /** Pedidas e não removidas (sem permissão, de outra empresa, já excluídas ou erro). */
  falhas: number;
  /** Primeiro erro devolvido pelo servidor, se houve. */
  erro: unknown | null;
};

/**
 * Exclui (soft) lançamentos da lista, um ou vários, conferindo cada linha.
 *
 * - Receita/despesa: `rpc_soft_delete` (via `softDelete`), que levanta erro
 *   quando nenhuma linha foi marcada. O `delete()` direto não servia: o trigger
 *   `soft_delete_generic` cancela o DELETE (RETURN NULL), então nem um
 *   `.select("id")` diferencia sucesso de bloqueio da RLS, e a tela anunciava
 *   sucesso com 0 linhas afetadas.
 * - Transferência: `rpc_excluir_transferencia`, a mesma da exclusão unitária
 *   (checa permissão e empresa e levanta erro se não achar); nunca um update
 *   direto em `transferencias`.
 */
export async function excluirLancamentos(rows: Pick<Lancamento, "id" | "tipo">[]): Promise<ResultadoExclusao> {
  const unicos = [...new Map(rows.map((l) => [`${l.tipo}:${l.id}`, l])).values()];
  let erro: unknown | null = null;

  const excluirUm = async ({ id, tipo }: Pick<Lancamento, "id" | "tipo">): Promise<boolean> => {
    const error =
      tipo === "transferencia"
        ? (await supabase.rpc("rpc_excluir_transferencia", { p_id: id } as never)).error
        : await softDelete(tipo === "receita" ? "receitas" : "despesas", id);
    if (error) erro ??= error;
    return !error;
  };

  const resultados = await Promise.all(unicos.map(excluirUm));
  const excluidos = resultados.filter(Boolean).length;
  return { excluidos, falhas: unicos.length - excluidos, erro };
}
