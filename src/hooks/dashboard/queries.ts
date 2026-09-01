import { supabase } from "@/integrations/supabase/client";
import { addDays, format } from "date-fns";
import { PROJECT_STATUS } from "@/constants";

export async function buildDashboardQueries(
  now: Date,
  mesAtualStart: Date,
  mesAtualEnd: Date,
  mesAnteriorStart: Date,
  mesAnteriorEnd: Date
) {
  const mesAtualStartStr = format(mesAtualStart, "yyyy-MM-dd");
  const mesAtualEndStr = format(mesAtualEnd, "yyyy-MM-dd");
  const mesAnteriorStartStr = format(mesAnteriorStart, "yyyy-MM-dd");
  const mesAnteriorEndStr = format(mesAnteriorEnd, "yyyy-MM-dd");

  const [
    receitasMes,
    receitasMesAnt,
    despesasMes,
    despesasMesAnt,
    receitasPendentes,
    despesasPendentes,
    projetos,
    leads,
    alertas,
    alertasCount,
    proximasReceitas,
    proximasDespesas,
    projetosAtivosCount,
  ] = await Promise.all([
    // receitasMes — busca por data_recebimento OU data_vencimento no mês atual
    supabase
      .from("receitas")
      .select("valor, status, data_recebimento, data_vencimento")
      .or(
        `and(data_recebimento.gte.${mesAtualStartStr},data_recebimento.lte.${mesAtualEndStr}),` +
          `and(data_vencimento.gte.${mesAtualStartStr},data_vencimento.lte.${mesAtualEndStr})`
      )
      .is("deleted_at", null),

    // receitasMesAnt — mês anterior
    supabase
      .from("receitas")
      .select("valor, status, data_recebimento, data_vencimento")
      .or(
        `and(data_recebimento.gte.${mesAnteriorStartStr},data_recebimento.lte.${mesAnteriorEndStr}),` +
          `and(data_vencimento.gte.${mesAnteriorStartStr},data_vencimento.lte.${mesAnteriorEndStr})`
      )
      .is("deleted_at", null),

    // despesasMes — busca por data_pagamento OU data_vencimento no mês atual
    supabase
      .from("despesas")
      .select("valor, status, data_pagamento, data_vencimento")
      .eq("is_fatura_payment", false)
      .or(
        `and(data_pagamento.gte.${mesAtualStartStr},data_pagamento.lte.${mesAtualEndStr}),` +
          `and(data_vencimento.gte.${mesAtualStartStr},data_vencimento.lte.${mesAtualEndStr})`
      )
      .is("deleted_at", null),

    // despesasMesAnt — mês anterior
    supabase
      .from("despesas")
      .select("valor, status, data_pagamento, data_vencimento")
      .eq("is_fatura_payment", false)
      .or(
        `and(data_pagamento.gte.${mesAnteriorStartStr},data_pagamento.lte.${mesAnteriorEndStr}),` +
          `and(data_vencimento.gte.${mesAnteriorStartStr},data_vencimento.lte.${mesAnteriorEndStr})`
      )
      .is("deleted_at", null),

    // receitasPendentes (A Receber) — escopado por data_vencimento no período
    supabase
      .from("receitas")
      .select("valor")
      .eq("status", "Pendente")
      .gte("data_vencimento", mesAtualStartStr)
      .lte("data_vencimento", mesAtualEndStr)
      .is("deleted_at", null),

    // despesasPendentes (A Pagar) — escopado por data_vencimento no período
    supabase
      .from("despesas")
      .select("valor")
      .eq("status", "Pendente")
      .gte("data_vencimento", mesAtualStartStr)
      .lte("data_vencimento", mesAtualEndStr)
      .is("deleted_at", null),

    // projetos para listagem (planejamento + em andamento, limite 8)
    // projetos_safe (view) mascara valor_contrato sem financeiro. Views não
    // embedam relação via PostgREST (sem FK visível), então clientes(nome)
    // é resolvido à parte logo depois do Promise.all.
    supabase
      .from("projetos_safe")
      .select(
        "id, codigo_projeto, nome, status, prioridade, status_data, valor_contrato, data_inicio, data_previsao, data_final, cliente_id"
      )
      .in("status", [PROJECT_STATUS.EM_ANDAMENTO, PROJECT_STATUS.PLANEJAMENTO])
      .order("created_at", { ascending: false })
      .limit(8),

    // leads
    supabase.from("leads").select("id, status, nome").is("deleted_at", null),

    // alertas (últimos não lidos)
    supabase
      .from("alertas")
      .select("id, tipo, severidade, titulo, mensagem, created_at")
      .eq("lido", false)
      .order("created_at", { ascending: false })
      .limit(5),

    // alertasCount — total de não lidos
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("lido", false),

    // proximasReceitas
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

    // proximasDespesas
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

    // projetosAtivosCount — count exato de projetos Em andamento (sem limit)
    // projetos_safe (view): SELECT * na tabela base foi revogado (20260879000000),
    // só colunas explícitas são concedidas e valor_contrato/custo_indireto_pct
    // ficam de fora. Usar a view evita 403 mesmo num select("*", head: true).
    supabase
      .from("projetos_safe")
      .select("id", { count: "exact", head: true })
      .eq("status", PROJECT_STATUS.EM_ANDAMENTO),
  ]);

  // clientes(nome) não vem embedado de projetos_safe (view, sem FK visível pro
  // PostgREST) — resolve à parte e reinjeta no mesmo formato que buildProjetos espera.
  const clienteIds = [...new Set((projetos.data ?? []).map((p) => p.cliente_id).filter((id): id is string => !!id))];
  if (clienteIds.length > 0) {
    const { data: clientesData } = await supabase.from("clientes").select("id, nome").in("id", clienteIds);
    const nomeByClienteId = new Map((clientesData ?? []).map((c) => [c.id, c.nome]));
    for (const p of projetos.data ?? []) {
      (p as unknown as { clientes: { nome: string } | null }).clientes = p.cliente_id
        ? { nome: nomeByClienteId.get(p.cliente_id) ?? "" }
        : null;
    }
  }

  return {
    receitasMes,
    receitasMesAnt,
    despesasMes,
    despesasMesAnt,
    receitasPendentes,
    despesasPendentes,
    projetos,
    leads,
    alertas,
    alertasCount,
    proximasReceitas,
    proximasDespesas,
    projetosAtivosCount,
  };
}
