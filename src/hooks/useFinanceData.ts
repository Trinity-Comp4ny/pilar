// Cache policy: dados financeiros (saldo/receitas/despesas) precisam estar fresh.
// staleTime 2min + refetchInterval 5min + refetchOnWindowFocus garantem que o
// usuário sempre veja números próximos da realidade ao voltar pra aba.
//
// Spec 044: agregação roda no banco (get_finance_stats/chart_mensal/chart_periodo/
// categorias), não mais em cima de um `select("*")` sem limite trazido pro client.
// O shape de retorno do hook é o mesmo de antes — os componentes que consomem
// useFinanceData não mudam nada.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface FinanceStatsRpc {
  receitas_total: number;
  despesas_total: number;
  receitas_total_geral: number;
  despesas_total_geral: number;
  receitas_prev_total: number;
  despesas_prev_total: number;
  a_receber_total: number;
  a_receber_count: number;
  a_pagar_total: number;
  a_pagar_count: number;
  top_receitas: Array<{ id: string; descricao: string; valor: number; data: string; status: string }> | null;
  top_despesas: Array<{ id: string; descricao: string; valor: number; data: string; status: string }> | null;
}

// Matizes distintos (não monocromáticos) pra diferenciar fatias adjacentes.
// Receitas: paleta fria/verde; Despesas: paleta quente/vermelha. Cor é responsabilidade
// do front — o banco só agrupa e soma.
const RECEITAS_COLORS = [
  "hsl(var(--c-green-600))",
  "hsl(var(--c-emerald-500))",
  "hsl(var(--c-cyan-500))",
  "hsl(var(--c-lime-500))",
  "hsl(var(--c-blue-500))",
  "hsl(var(--c-indigo-500))",
  "hsl(var(--c-violet-500))",
  "hsl(var(--c-purple-500))",
];
const DESPESAS_COLORS = [
  "hsl(var(--c-red-600))",
  "hsl(var(--c-orange-500))",
  "hsl(var(--c-amber-500))",
  "hsl(var(--c-pink-500))",
  "hsl(var(--c-red-400))",
  "hsl(var(--c-orange-700))",
  "hsl(var(--c-yellow-600))",
  "hsl(var(--c-purple-600))",
];

function withColors(
  rows: Array<{ categoria_nome: string; valor: number; count: number }>,
  tipo: "receitas" | "despesas"
) {
  const colors = tipo === "receitas" ? RECEITAS_COLORS : DESPESAS_COLORS;
  return rows.map((r, i) => ({
    name: r.categoria_nome,
    value: Number(r.valor),
    count: Number(r.count),
    color: colors[i % colors.length],
  }));
}

function growthPct(total: number, prevTotal: number): string {
  return (prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0).toFixed(1);
}

export const useFinanceData = (dateFrom?: Date, dateTo?: Date) => {
  return useQuery({
    queryKey: ["finance-data", dateFrom, dateTo],
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Sem dateFrom/dateTo = "Todo o período" (spec 024): sem filtro de data, sem
      // comparação com período anterior. As RPCs tratam p_data_inicio/p_data_fim NULL
      // como all-time por conta própria (mesmo default de mês corrente pro cálculo de
      // crescimento, que não se aplica quando all_time é true).
      const p_data_inicio = dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined;
      const p_data_fim = dateTo ? format(dateTo, "yyyy-MM-dd") : undefined;
      const allTime = !dateFrom && !dateTo;

      const [statsRes, chartMensalRes, chartPeriodoRes, catReceitasRes, catDespesasRes] = await Promise.all([
        supabase.rpc("get_finance_stats", { p_data_inicio, p_data_fim }),
        supabase.rpc("get_finance_chart_mensal", { p_data_inicio, p_data_fim }),
        supabase.rpc("get_finance_chart_periodo", { p_data_inicio, p_data_fim }),
        supabase.rpc("get_finance_categorias", { p_tipo: "receitas", p_data_inicio, p_data_fim }),
        supabase.rpc("get_finance_categorias", { p_tipo: "despesas", p_data_inicio, p_data_fim }),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (chartMensalRes.error) throw chartMensalRes.error;
      if (chartPeriodoRes.error) throw chartPeriodoRes.error;
      if (catReceitasRes.error) throw catReceitasRes.error;
      if (catDespesasRes.error) throw catDespesasRes.error;

      const s = statsRes.data as unknown as FinanceStatsRpc;

      const receitasTotal = Number(s.receitas_total);
      const despesasTotal = Number(s.despesas_total);
      const receitasTotalGeral = Number(s.receitas_total_geral);
      const despesasTotalGeral = Number(s.despesas_total_geral);

      const stats = {
        receitasTotal,
        despesasTotal,
        receitasTotalGeral,
        despesasTotalGeral,
        receitasMes: allTime ? "0.0" : growthPct(receitasTotal, Number(s.receitas_prev_total)),
        despesasMes: allTime ? "0.0" : growthPct(despesasTotal, Number(s.despesas_prev_total)),
        saldo: receitasTotal - despesasTotal,
        saldoGeral: receitasTotalGeral - despesasTotalGeral,
        aReceber: { total: Number(s.a_receber_total), count: Number(s.a_receber_count) },
        aPagar: { total: Number(s.a_pagar_total), count: Number(s.a_pagar_count) },
      };

      const chartData = (chartMensalRes.data ?? []).map((r) => ({
        mes: r.mes,
        receitas: Number(r.receitas),
        despesas: Number(r.despesas),
      }));

      const chartDataDiario = (chartPeriodoRes.data ?? []).map((r) => ({
        dia: r.bucket_label,
        receitas: Number(r.receitas),
        despesas: Number(r.despesas),
      }));

      const categoriaData = withColors(catReceitasRes.data ?? [], "receitas");
      const despesasCategoriaData = withColors(catDespesasRes.data ?? [], "despesas");

      const topReceitas = (s.top_receitas ?? []).map((r) => ({
        id: r.id,
        descricao: r.descricao,
        valor: Number(r.valor),
        data: r.data,
        status: r.status,
      }));
      const topDespesas = (s.top_despesas ?? []).map((d) => ({
        id: d.id,
        descricao: d.descricao,
        valor: Number(d.valor),
        data: d.data,
        status: d.status,
      }));

      return {
        stats,
        chartData,
        chartDataDiario,
        categoriaData,
        despesasCategoriaData,
        topReceitas,
        topDespesas,
      };
    },
  });
};
