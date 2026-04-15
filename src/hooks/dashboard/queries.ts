import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, addDays } from "date-fns";
import { PROJECT_STATUS } from "@/constants";

export function buildDashboardQueries(
  now: Date,
  mesAtualStart: Date,
  mesAtualEnd: Date,
  mesAnteriorStart: Date,
  mesAnteriorEnd: Date,
  chartStart: Date
) {
  return Promise.all([
    // 0: receitasMes
    supabase
      .from("receitas")
      .select("valor")
      .gte("data_vencimento", mesAtualStart.toISOString())
      .lte("data_vencimento", mesAtualEnd.toISOString())
      .is("deleted_at", null),

    // 1: receitasMesAnt
    supabase
      .from("receitas")
      .select("valor")
      .gte("data_vencimento", mesAnteriorStart.toISOString())
      .lte("data_vencimento", mesAnteriorEnd.toISOString())
      .is("deleted_at", null),

    // 2: despesasMes
    supabase
      .from("despesas")
      .select("valor")
      .gte("data_vencimento", mesAtualStart.toISOString())
      .lte("data_vencimento", mesAtualEnd.toISOString())
      .is("deleted_at", null),

    // 3: despesasMesAnt
    supabase
      .from("despesas")
      .select("valor")
      .gte("data_vencimento", mesAnteriorStart.toISOString())
      .lte("data_vencimento", mesAnteriorEnd.toISOString())
      .is("deleted_at", null),

    // 4: receitasPendentes
    supabase.from("receitas").select("valor").eq("status", "Pendente").is("deleted_at", null),

    // 5: despesasPendentes
    supabase.from("despesas").select("valor").eq("status", "Pendente").is("deleted_at", null),

    // 6: projetos
    supabase
      .from("projetos")
      .select(
        "id, codigo_projeto, nome, status, prioridade, status_data, valor_contrato, data_inicio, data_previsao, data_final, cliente_id, clientes(nome)"
      )
      .is("deleted_at", null)
      .in("status", [PROJECT_STATUS.EM_ANDAMENTO, PROJECT_STATUS.PLANEJAMENTO])
      .order("created_at", { ascending: false })
      .limit(8),

    // 7: leads
    supabase.from("leads").select("id, status, nome").is("deleted_at", null),

    // 8: alertas
    supabase
      .from("alertas")
      .select("id, tipo, severidade, titulo, mensagem, created_at")
      .eq("lido", false)
      .order("created_at", { ascending: false })
      .limit(5),

    // 9: alertasNaoLidos count
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("lido", false),

    // 10: receitasChart
    supabase
      .from("receitas")
      .select("valor, data_recebimento, data_vencimento, status")
      .gte("data_vencimento", startOfMonth(chartStart).toISOString())
      .is("deleted_at", null),

    // 11: despesasChart
    supabase
      .from("despesas")
      .select("valor, data_pagamento, data_vencimento, status")
      .gte("data_vencimento", startOfMonth(chartStart).toISOString())
      .is("deleted_at", null),

    // 12: proximasReceitas
    supabase
      .from("receitas")
      .select(
        "id, descricao, valor, data_vencimento, status, projeto_id, projetos(codigo_projeto), cliente_id, clientes(nome)"
      )
      .eq("status", "Pendente")
      .gte("data_vencimento", now.toISOString())
      .lte("data_vencimento", addDays(now, 30).toISOString())
      .is("deleted_at", null)
      .order("data_vencimento", { ascending: true })
      .limit(5),

    // 13: proximasDespesas
    supabase
      .from("despesas")
      .select(
        "id, descricao, valor, data_vencimento, status, projeto_id, projetos(codigo_projeto), fornecedor_id, fornecedores(nome)"
      )
      .eq("status", "Pendente")
      .gte("data_vencimento", now.toISOString())
      .lte("data_vencimento", addDays(now, 30).toISOString())
      .is("deleted_at", null)
      .order("data_vencimento", { ascending: true })
      .limit(5),
  ]);
}
