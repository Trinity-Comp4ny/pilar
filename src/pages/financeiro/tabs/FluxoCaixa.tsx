import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
} from "recharts";
import { CustomTooltip } from "../components/CustomTooltip";
import { FinanceErrorState } from "../components/FinanceErrorState";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useTopTransactions } from "../hooks/useTopTransactions";

interface FluxoCaixaProps {
  dateFrom?: Date;
  dateTo?: Date;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export default function FluxoCaixa({ dateFrom, dateTo }: FluxoCaixaProps) {
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
    isError: isErrorDashboard,
    refetch: refetchDashboard,
  } = useFinanceData(dateFrom, dateTo);

  const {
    data: topTransactions,
    isLoading: isLoadingTop,
    isError: isErrorTop,
    refetch: refetchTop,
  } = useTopTransactions(dateFrom, dateTo);

  if (isLoadingDashboard || isLoadingTop) {
    return (
      <div className="space-y-6 w-full max-w-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="vrz-card w-full">
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="vrz-card w-full">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[360px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isErrorDashboard || isErrorTop) {
    return (
      <FinanceErrorState
        onRetry={() => {
          void refetchDashboard();
          void refetchTop();
        }}
      />
    );
  }

  const stats = dashboardData?.stats || {
    receitasTotal: 0,
    receitasMes: 0,
    despesasTotal: 0,
    despesasMes: 0,
    saldo: 0,
  };

  const chartData = dashboardData?.chartData || [];
  const chartDataDiario = dashboardData?.chartDataDiario || [];
  const hasMonthlyData = chartData.some((item) => item.receitas > 0 || item.despesas > 0);
  const hasDailyData = chartDataDiario.some((item) => item.receitas > 0 || item.despesas > 0);

  const totalTopReceitas = topTransactions?.receitas.reduce((acc: number, curr) => acc + Number(curr.valor), 0) || 0;
  const totalTopDespesas = topTransactions?.despesas.reduce((acc: number, curr) => acc + Number(curr.valor), 0) || 0;

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        <Card className="vrz-card bg-positive/10 border-positive/10 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 truncate">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-base sm:text-lg xl:text-xl font-bold text-green-700 tabular-nums whitespace-nowrap">
              {formatCurrency(stats.receitasTotal)}
            </div>
            <p
              className={`text-xs mt-1 flex items-center min-w-0 ${Number(stats.receitasMes) < 0 ? "text-red-600" : "text-green-600"}`}
            >
              {Number(stats.receitasMes) < 0 ? (
                <ArrowDownRight size={12} className="mr-1 flex-shrink-0" />
              ) : (
                <ArrowUpRight size={12} className="mr-1 flex-shrink-0" />
              )}
              <span className="truncate">{stats.receitasMes}% vs período anterior</span>
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card bg-red-50 border-red-100 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 truncate">Despesas</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-base sm:text-lg xl:text-xl font-bold text-red-700 tabular-nums whitespace-nowrap">
              {formatCurrency(stats.despesasTotal)}
            </div>
            <p
              className={`text-xs mt-1 flex items-center min-w-0 ${Number(stats.despesasMes) > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {Number(stats.despesasMes) > 0 ? (
                <ArrowUpRight size={12} className="mr-1 flex-shrink-0" />
              ) : (
                <ArrowDownRight size={12} className="mr-1 flex-shrink-0" />
              )}
              <span className="truncate">{stats.despesasMes}% vs período anterior</span>
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card bg-blue-50 border-blue-100 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 truncate">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-base sm:text-lg xl:text-xl font-bold text-blue-700 tabular-nums whitespace-nowrap">
              {formatCurrency(stats.saldo)}
            </div>
            <p className="text-xs text-blue-600 mt-1 truncate">
              Margem de {stats.receitasTotal > 0 ? ((stats.saldo / stats.receitasTotal) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico mensal — barras + saldo */}
      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle>Fluxo de Caixa</CardTitle>
          <CardDescription>Entradas, saídas e saldo líquido por período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[360px] w-full relative">
            {!hasMonthlyData && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <p className="text-muted-foreground text-sm">Sem registros no período</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
                <XAxis dataKey="mes" stroke="hsl(var(--chart-neutral))" axisLine={false} tickLine={false} />
                <YAxis stroke="hsl(var(--chart-neutral))" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="receitas"
                  name="Entradas"
                  fill="hsl(var(--chart-success))"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="despesas"
                  name="Saídas"
                  fill="hsl(var(--chart-danger))"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Line
                  type="monotone"
                  dataKey={(d) => d.receitas - d.despesas}
                  name="Saldo Líquido"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance diária */}
      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle>Performance Diária</CardTitle>
          <CardDescription>Acompanhamento do período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full relative">
            {!hasDailyData && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <p className="text-muted-foreground text-sm">Sem registros no período</p>
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

      {/* Top 5 receitas e despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-positive-strong" />
              Principais Receitas
            </CardTitle>
            <CardDescription>Top 5 entradas no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTransactions?.receitas.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-positive/10 rounded-lg border border-positive/10 hover:bg-positive/20 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.data_recebimento ? new Date(item.data_recebimento).toLocaleDateString("pt-BR") : "—"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-positive-strong">{formatCurrency(item.valor)}</span>
                </div>
              ))}
              {topTransactions?.receitas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma receita encontrada.</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-black/10">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total das 5 principais</span>
                <span className="text-lg font-bold text-positive-strong">{formatCurrency(totalTopReceitas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Principais Despesas
            </CardTitle>
            <CardDescription>Top 5 saídas no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTransactions?.despesas.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
            <div className="mt-4 pt-4 border-t border-black/10">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total das 5 principais</span>
                <span className="text-lg font-bold text-red-600">{formatCurrency(totalTopDespesas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
