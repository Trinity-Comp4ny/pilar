import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, addDays, format } from "date-fns";
import { PROJECT_STATUS } from "@/constants";

export function buildDashboardQueries(
  now: Date,
  mesAtualStart: Date,
  mesAtualEnd: Date,
  mesAnteriorStart: Date,
  mesAnteriorEnd: Date,
  chartStart: Date
) {
  const mesAtualStartStr = format(mesAtualStart, "yyyy-MM-dd");
  const mesAtualEndStr = format(mesAtualEnd, "yyyy-MM-dd");
  const mesAnteriorStartStr = format(mesAnteriorStart, "yyyy-MM-dd");
  const mesAnteriorEndStr = format(mesAnteriorEnd, "yyyy-MM-dd");

  return Promise.all([
    // 0: receitasMes — busca por data_recebimento OU data_vencimento no mês atual
    supabase
      .from("receitas")
      .select("valor, status, data_recebimento, data_vencimento")
      .or(
        `and(data_recebimento.gte.${mesAtualStartStr},data_recebimento.lte.${mesAtualEndStr}),` +
          `and(data_vencimento.gte.${mesAtualStartStr},data_vencimento.lte.${mesAtualEndStr})`
      )
      .is("deleted_at", null),

    // 1: receitasMesAnt — mês anterior
    supabase
      .from("receitas")
      .select("valor, status, data_recebimento, data_vencimento")
      .or(
        `and(data_recebimento.gte.${mesAnteriorStartStr},data_recebimento.lte.${mesAnteriorEndStr}),` +
          `and(data_vencimento.gte.${mesAnteriorStartStr},data_vencimento.lte.${mesAnteriorEndStr})`
      )
      .is("deleted_at", null),

    // 2: despesasMes — busca por data_pagamento OU data_vencimento no mês atual
    supabase
      .from("despesas")
      .select("valor, status, data_pagamento, data_vencimento")
      .eq("is_fatura_payment", false)
      .or(
        `and(data_pagamento.gte.${mesAtualStartStr},data_pagamento.lte.${mesAtualEndStr}),` +
          `and(data_vencimento.gte.${mesAtualStartStr},data_vencimento.lte.${mesAtualEndStr})`
      )
      .is("deleted_at", null),

    // 3: despesasMesAnt — mês anterior
    supabase
      .from("despesas")
      .select("valor, status, data_pagamento, data_vencimento")
      .eq("is_fatura_payment", false)
      .or(
        `and(data_pagamento.gte.${mesAnteriorStartStr},data_pagamento.lte.${mesAnteriorEndStr}),` +
          `and(data_vencimento.gte.${mesAnteriorStartStr},data_vencimento.lte.${mesAnteriorEndStr})`
      )
      .is("deleted_at", null),

    // 4: receitasPendentes (A Receber)
    supabase.from("receitas").select("valor").eq("status", "Pendente").is("deleted_at", null),

    // 5: despesasPendentes (A Pagar)
    supabase.from("despesas").select("valor").eq("status", "Pendente").is("deleted_at", null),

    // 6: projetos para listagem (planejamento + em andamento, limite 8)
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
      .gte("data_vencimento", format(startOfMonth(chartStart), "yyyy-MM-dd"))
      .is("deleted_at", null),

    // 11: despesasChart
    supabase
      .from("despesas")
      .select("valor, data_pagamento, data_vencimento, status")
      .eq("is_fatura_payment", false)
      .gte("data_vencimento", format(startOfMonth(chartStart), "yyyy-MM-dd"))
      .is("deleted_at", null),

    // 12: proximasReceitas
    supabase
      .from("receitas")
      .select(
        "id, descricao, valor, data_vencimento, status, projeto_id, projetos(codigo_projeto), cliente_id, clientes(nome)"
      )
      .eq("status", "Pendente")
      .gte("data_vencimento", format(now, "yyyy-MM-dd"))
      .lte("data_vencimento", format(addDays(now, 30), "yyyy-MM-dd"))
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
      .gte("data_vencimento", format(now, "yyyy-MM-dd"))
      .lte("data_vencimento", format(addDays(now, 30), "yyyy-MM-dd"))
      .is("deleted_at", null)
      .order("data_vencimento", { ascending: true })
      .limit(5),

    // 14: count exato de projetos Em andamento (sem limit)
    supabase
      .from("projetos")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", PROJECT_STATUS.EM_ANDAMENTO),
  ]);
}
