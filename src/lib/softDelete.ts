import { supabase } from "@/integrations/supabase/client";

/**
 * Soft delete das tabelas cuja policy de SELECT esconde linha deletada.
 *
 * Por que não dá para fazer `.update({ deleted_at })` direto nessas tabelas: um
 * UPDATE que referencia coluna no WHERE (o `.eq("id", id)` de sempre) faz o
 * Postgres aplicar a policy de SELECT também à LINHA NOVA. A linha nova tem
 * deleted_at preenchido, a policy exige `deleted_at IS NULL`, e a escrita volta
 * como `42501 new row violates row-level security policy`.
 *
 * Medido em produção em 24/08: excluir cliente, receita, despesa, conta e
 * projeto falhava para todo mundo. Ver SPEC 060 e migration 20260859000000.
 *
 * Esta lista espelha a allowlist da função `_soft_delete_feature` no banco.
 * `src/lib/softDelete.test.ts` compara as duas: acrescentar tabela num lado sem
 * o outro reprova o teste, em vez de falhar em produção.
 */
export const TABELAS_SOFT_DELETE_POR_RPC = new Set([
  "clientes",
  "projetos",
  "fornecedores",
  "receitas",
  "despesas",
  "contas",
  "cartoes",
  "faturas",
  "categorias_financeiras",
  "marcos_faturamento",
  "templates_projeto",
  "obras",
  "obra_material",
  "obra_material_mov",
  "obra_cotacao",
  "obra_cotacao_proposta",
  "obra_conta_lancamento",
]);

type Erro = { message: string } | null;

/**
 * Exclui (soft) uma linha. Tabela fora da lista cai no UPDATE direto, que é o
 * caminho correto para quem não tem `deleted_at` na policy de SELECT (leads,
 * propostas, pessoas, metas, centros_custo, folha_pagamento, transferencias).
 */
export async function softDelete(tabela: string, id: string): Promise<Erro> {
  if (TABELAS_SOFT_DELETE_POR_RPC.has(tabela)) {
    const { error } = await supabase.rpc("rpc_soft_delete", { p_tabela: tabela, p_id: id });
    return error;
  }
  const { error } = await supabase
    .from(tabela as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  return error;
}

/** Exclui (soft) todas as parcelas de um grupo. */
export async function softDeleteGrupo(tabela: string, grupoParcela: string): Promise<Erro> {
  if (TABELAS_SOFT_DELETE_POR_RPC.has(tabela)) {
    const { error } = await supabase.rpc("rpc_soft_delete_grupo", {
      p_tabela: tabela,
      p_grupo: grupoParcela,
    });
    return error;
  }
  const { error } = await supabase
    .from(tabela as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("grupo_parcela", grupoParcela)
    .is("deleted_at", null);
  return error;
}

/** Desfaz a exclusão (o "Desfazer" dos toasts). */
export async function restaurar(tabela: string, id: string): Promise<Erro> {
  if (TABELAS_SOFT_DELETE_POR_RPC.has(tabela)) {
    const { error } = await supabase.rpc("rpc_restaurar", { p_tabela: tabela, p_id: id });
    return error;
  }
  const { error } = await supabase
    .from(tabela as never)
    .update({ deleted_at: null } as never)
    .eq("id", id);
  return error;
}
