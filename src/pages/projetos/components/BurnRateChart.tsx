import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

interface BurnRateChartProps {
  projetoId: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function BurnRateChart({ projetoId }: BurnRateChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["burn-rate", projetoId],
    queryFn: async () => {
      // Buscar orçamento total
      const { data: orcamento } = await supabase
        .from("projeto_orcamento_fases")
        .select("horas_estimadas, custo_hora, valor_venda")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null);

      const orcamentoTotal = (orcamento || []).reduce(
        (s, r) => s + Number(r.horas_estimadas) * Number(r.custo_hora),
        0
      );
      const valorVendaTotal = (orcamento || []).reduce((s, r) => s + Number(r.valor_venda), 0);

      // Buscar despesas por mês
      const { data: despesas } = await supabase
        .from("despesas")
        .select("valor, data_vencimento")
        .eq("projeto_id", projetoId)
        .in("status", ["Pago", "Pendente"])
        .is("deleted_at", null)
        .order("data_vencimento");

      // Buscar receitas por mês
      const { data: receitas } = await supabase
        .from("receitas")
        .select("valor, data_vencimento")
        .eq("projeto_id", projetoId)
        .in("status", ["Recebido", "Pendente"])
        .is("deleted_at", null)
        .order("data_vencimento");

      // Agrupar por mês
      const meses = new Map<string, { custos: number; receitas: number }>();

      for (const d of despesas || []) {
        const key = d.data_vencimento?.substring(0, 7) || "unknown";
        const m = meses.get(key) || { custos: 0, receitas: 0 };
        m.custos += Number(d.valor) || 0;
        meses.set(key, m);
      }

      for (const r of receitas || []) {
        const key = r.data_vencimento?.substring(0, 7) || "unknown";
        const m = meses.get(key) || { custos: 0, receitas: 0 };
        m.receitas += Number(r.valor) || 0;
        meses.set(key, m);
      }

      // Criar série temporal acumulada
      const sortedKeys = Array.from(meses.keys()).sort();
      let custoAcum = 0;
      let receitaAcum = 0;

      const serie = sortedKeys.map((key) => {
        const m = meses.get(key)!;
        custoAcum += m.custos;
        receitaAcum += m.receitas;
        const date = new Date(key + "-01");
        return {
          mes: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          custo_acumulado: Math.round(custoAcum),
          receita_acumulada: Math.round(receitaAcum),
          orcamento: Math.round(orcamentoTotal),
        };
      });

      const pctConsumido = orcamentoTotal > 0 ? (custoAcum / orcamentoTotal) * 100 : 0;

      return { serie, orcamentoTotal, valorVendaTotal, custoAcum, receitaAcum, pctConsumido };
    },
    staleTime: 1000 * 60 * 3,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const { serie = [], orcamentoTotal = 0, custoAcum = 0, receitaAcum = 0, pctConsumido = 0 } = data || {};

  const statusColor = pctConsumido > 90 ? "text-red-600" : pctConsumido > 70 ? "text-amber-600" : "text-emerald-600";
  const statusLabel = pctConsumido > 90 ? "Crítico" : pctConsumido > 70 ? "Atenção" : "Saudável";
  const statusBadge =
    pctConsumido > 90
      ? "bg-red-100 text-red-800"
      : pctConsumido > 70
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Burn Rate
          </CardTitle>
          <Badge className={`${statusBadge} text-xs`}>
            {statusLabel} — {pctConsumido.toFixed(0)}% consumido
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* KPIs inline */}
        <div className="flex gap-6 mb-4 text-sm">
          <div>
            <span className="text-muted-foreground">Orçamento: </span>
            <span className="font-medium">{formatCurrency(orcamentoTotal)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Custo acum.: </span>
            <span className={`font-medium ${statusColor}`}>{formatCurrency(custoAcum)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Receita acum.: </span>
            <span className="font-medium text-emerald-600">{formatCurrency(receitaAcum)}</span>
          </div>
        </div>

        {serie.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem lançamentos financeiros neste projeto.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={serie} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend fontSize={11} />
              <ReferenceLine
                y={orcamentoTotal}
                stroke="hsl(var(--chart-neutral))"
                strokeDasharray="5 5"
                label={{ value: "Orçamento", fontSize: 10, fill: "hsl(var(--chart-neutral))" }}
              />
              <Line
                type="monotone"
                dataKey="custo_acumulado"
                name="Custo Acum."
                stroke="hsl(var(--chart-danger))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="receita_acumulada"
                name="Receita Acum."
                stroke="hsl(var(--chart-success-alt))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
