import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { CustomTooltip } from "../components/CustomTooltip";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { startOfMonth, endOfMonth } from "date-fns";

interface ResumoMensalProps {
  dateFrom?: Date;
  dateTo?: Date;
}

export default function ResumoMensal({ dateFrom, dateTo }: ResumoMensalProps) {
  const { data: dashboardData, isLoading: isLoadingDashboard } = useFinanceData(dateFrom, dateTo);

  const { data: topTransactions, isLoading: isLoadingTop } = useQuery({
    queryKey: ["top-transactions-month", dateFrom, dateTo],
    queryFn: async () => {
      const today = new Date();
      const start = dateFrom || startOfMonth(today);
      const end = dateTo || endOfMonth(today);

      const firstDay = start.toISOString();
      const lastDay = end.toISOString();

      const { data: receitas } = await supabase
        .from("receitas")
        .select("*")
        .gte("data_recebimento", firstDay)
        .lte("data_recebimento", lastDay)
        .order("valor", { ascending: false })
        .limit(5);

      const { data: despesas } = await supabase
        .from("despesas")
        .select("*, categorias_financeiras(nome)")
        .gte("data_pagamento", firstDay)
        .lte("data_pagamento", lastDay)
        .order("valor", { ascending: false })
        .limit(5);

      return {
        receitas: receitas || [],
        despesas: despesas || [],
      };
    },
  });

  if (isLoadingDashboard || isLoadingTop) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = dashboardData?.stats || {
    receitasTotal: 0,
    receitasMes: 0,
    despesasTotal: 0,
    despesasMes: 0,
    saldo: 0,
  };

  const chartDataDiario = dashboardData?.chartDataDiario || [];
  const hasChartData = chartDataDiario.some((item) => item.receitas > 0 || item.despesas > 0);

  // Calculate totals for top 5 to display
  const totalTopReceitas = topTransactions?.receitas.reduce((acc: number, curr) => acc + Number(curr.valor), 0) || 0;
  const totalTopDespesas = topTransactions?.despesas.reduce((acc: number, curr) => acc + Number(curr.valor), 0) || 0;

  // Format currency
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        <Card className="vrz-card bg-green-50 border-green-100 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.receitasTotal)}
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center">
              <ArrowUpRight size={12} className="mr-1" />
              {stats.receitasMes}% vs mês anterior
            </p>
          </CardContent>
        </Card>
        <Card className="vrz-card bg-red-50 border-red-100 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.despesasTotal)}
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center">
              <ArrowDownRight size={12} className="mr-1" />
              {stats.despesasMes}% vs mês anterior
            </p>
          </CardContent>
        </Card>
        <Card className="vrz-card bg-blue-50 border-blue-100 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.saldo)}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Margem de {stats.receitasTotal > 0 ? ((stats.saldo / stats.receitasTotal) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="vrz-card border-black/5 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-black/60">Projeção Final</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const today = new Date();
              const start = dateFrom || startOfMonth(today);
              const end = dateTo || endOfMonth(today);
              const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
              const elapsedDays = Math.min(
                totalDays,
                Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
              );
              const projection = (stats.saldo / elapsedDays) * totalDays;
              return (
                <div className="text-2xl font-bold text-black/80">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(projection)}
                </div>
              );
            })()}
            <p className="text-xs text-black/50 mt-1">Baseado na média diária</p>
          </CardContent>
        </Card>
      </div>

      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle>Performance Diária</CardTitle>
          <CardDescription>Acompanhamento do mês corrente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full relative">
            {!hasChartData && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <p className="text-muted-foreground text-sm">Não possui registros de dados ainda</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataDiario}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
                <XAxis dataKey="dia" stroke="hsl(var(--chart-neutral))" axisLine={false} tickLine={false} />
                <YAxis stroke="hsl(var(--chart-neutral))" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="receitas"
                  stackId="1"
                  stroke="hsl(var(--chart-success))"
                  fill="hsl(var(--chart-success))"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="despesas"
                  stackId="2"
                  stroke="hsl(var(--chart-danger))"
                  fill="hsl(var(--chart-danger))"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento de Receitas e Despesas do Mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Principais Receitas do Mês
            </CardTitle>
            <CardDescription>Top 5 entradas de receita</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTransactions?.receitas.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.descricao}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.data_recebimento ? new Date(item.data_recebimento).toLocaleDateString("pt-BR") : "—"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-green-700">{formatCurrency(item.valor)}</span>
                </div>
              ))}
              {topTransactions?.receitas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma receita encontrada.</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total das 5 principais</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(totalTopReceitas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Principais Despesas do Mês
            </CardTitle>
            <CardDescription>Top 5 saídas de despesa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTransactions?.despesas.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.descricao}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString("pt-BR") : "—"} •{" "}
                      {item.categorias_financeiras?.nome || "Outros"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-red-700">{formatCurrency(item.valor)}</span>
                </div>
              ))}
              {topTransactions?.despesas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa encontrada.</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total das 5 principais</span>
                <span className="text-lg font-bold text-red-600">{formatCurrency(totalTopDespesas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
