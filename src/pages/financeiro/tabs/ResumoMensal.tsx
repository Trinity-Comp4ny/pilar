import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/KPICard";
import { formatCurrency, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { CustomTooltip } from "../components/CustomTooltip";
import { FinanceErrorState } from "../components/FinanceErrorState";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useTopTransactions } from "../hooks/useTopTransactions";

import { startOfMonth, endOfMonth } from "date-fns";

interface ResumoMensalProps {
  dateFrom?: Date;
  dateTo?: Date;
}

export default function ResumoMensal({ dateFrom, dateTo }: ResumoMensalProps) {
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
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  const chartDataDiario = dashboardData?.chartDataDiario || [];
  const hasChartData = chartDataDiario.some((item) => item.receitas > 0 || item.despesas > 0);

  // Calculate totals for top 5 to display
  const totalTopReceitas = topTransactions?.receitas.reduce((acc: number, curr) => acc + Number(curr.valor), 0) || 0;
  const totalTopDespesas = topTransactions?.despesas.reduce((acc: number, curr) => acc + Number(curr.valor), 0) || 0;

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <KPICard
          label="Receitas"
          value={stats.receitasTotal}
          tone="positive"
          delta={{ value: Number(stats.receitasMes) }}
        />
        <KPICard
          label="Despesas"
          value={stats.despesasTotal}
          tone="danger"
          delta={{ value: Number(stats.despesasMes), invert: true }}
        />
        <KPICard
          label="Saldo do período"
          value={stats.saldo}
          tone={stats.saldo >= 0 ? "positive" : "danger"}
          subtitle="Entradas menos saídas no caixa"
        />
        {(() => {
          const today = new Date();
          const start = dateFrom || startOfMonth(today);
          const end = dateTo || endOfMonth(today);
          // Só faz sentido projetar um período em andamento. Período já encerrado
          // ou totalmente no futuro mostra o saldo real, sem extrapolar.
          const isOngoing = today >= start && today <= end;
          const dayMs = 1000 * 60 * 60 * 24;
          const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1);
          const elapsedDays = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / dayMs) + 1);
          const projection = isOngoing ? (stats.saldo / elapsedDays) * totalDays : stats.saldo;
          return (
            <KPICard
              label="Projeção final"
              value={projection}
              subtitle={isOngoing ? "Baseado na média diária" : "Período encerrado, saldo real"}
            />
          );
        })()}
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Performance diária</CardTitle>
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
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-positive-strong" />
              Principais Receitas do Mês
            </CardTitle>
            <CardDescription>Top 5 entradas de receita</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTransactions?.receitas.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-positive/10 rounded-lg border border-positive/10 hover:bg-positive/10 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.data_recebimento ? formatDate(item.data_recebimento) : "—"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-positive-strong">{formatCurrency(item.valor)}</span>
                </div>
              ))}
              {topTransactions?.receitas.length === 0 && (
                <EmptyState
                  icon={TrendingUp}
                  title="Nenhuma receita encontrada"
                  description="As principais receitas do mês aparecem aqui."
                  className="py-6"
                />
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

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-negative-strong" />
              Principais Despesas do Mês
            </CardTitle>
            <CardDescription>Top 5 saídas de despesa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTransactions?.despesas.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-danger-soft rounded-lg border border-danger-soft hover:bg-danger-soft/70 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.data_pagamento ? formatDate(item.data_pagamento) : "—"} •{" "}
                      {item.categorias_financeiras?.nome || "Outros"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-negative-strong">{formatCurrency(item.valor)}</span>
                </div>
              ))}
              {topTransactions?.despesas.length === 0 && (
                <EmptyState
                  icon={TrendingDown}
                  title="Nenhuma despesa encontrada"
                  description="As principais despesas do mês aparecem aqui."
                  className="py-6"
                />
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-black/10">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total das 5 principais</span>
                <span className="text-lg font-bold text-negative-strong">{formatCurrency(totalTopDespesas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
