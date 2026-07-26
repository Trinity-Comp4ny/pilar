import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency as fmtMoeda } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Clock,
  Trophy,
} from "lucide-react";
import { formatDateDisplay } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";
import { CustomTooltip } from "../components/CustomTooltip";
import { FinanceErrorState } from "../components/FinanceErrorState";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useFinanceFilter } from "../hooks/useFinanceFilter";

const formatCurrency = (val: number) => fmtMoeda(val);

function VisaoGeralSkeleton() {
  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 w-full">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="w-full">
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
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {[1, 2].map((i) => (
          <Card key={i} className="w-full">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[320px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface DonutProps {
  data: Array<{ name: string; value: number; color: string }>;
  totalLabel: string;
}

function DonutChart({ data, totalLabel }: DonutProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
          <Label
            position="center"
            content={({ viewBox }) => {
              const { cx, cy } = (viewBox as { cx: number; cy: number }) ?? { cx: 0, cy: 0 };
              return (
                <>
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill="hsl(var(--chart-neutral))"
                    style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    {totalLabel}
                  </text>
                  <text
                    x={cx}
                    y={cy + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill="hsl(var(--foreground))"
                  >
                    {formatCurrency(total)}
                  </text>
                </>
              );
            }}
          />
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value, entry) => {
            const v = (entry?.payload as { value?: number } | undefined)?.value ?? 0;
            return (
              <span className="text-xs text-foreground">
                {value} — {formatCurrency(v)}
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function VisaoGeral() {
  const { visualizacao, dateFrom, dateTo } = useFinanceFilter();
  const { data: dashboardData, isLoading, isError, refetch } = useFinanceData(dateFrom, dateTo);

  if (isLoading) return <VisaoGeralSkeleton />;

  if (isError) return <FinanceErrorState onRetry={() => void refetch()} />;

  const stats = dashboardData?.stats || {
    receitasTotal: 0,
    receitasMes: 0,
    despesasTotal: 0,
    despesasMes: 0,
    saldo: 0,
    aReceber: { total: 0, count: 0 },
    aPagar: { total: 0, count: 0 },
  };
  const topReceitas = dashboardData?.topReceitas ?? [];
  const topDespesas = dashboardData?.topDespesas ?? [];

  const chartData = visualizacao === "dia" ? dashboardData?.chartDataDiario || [] : dashboardData?.chartData || [];
  const categoriaData = dashboardData?.categoriaData || [];
  const despesasCategoriaData = dashboardData?.despesasCategoriaData || [];

  const hasChartData = chartData.some((item) => item.receitas > 0 || item.despesas > 0);
  const hasReceitasData = categoriaData.length > 0;
  const hasDespesasData = despesasCategoriaData.length > 0;

  const margem = stats.receitasTotal > 0 ? ((stats.saldo / stats.receitasTotal) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* KPIs: Lucro líquido como card primário (métrica da tagline); demais neutros */}
      <div className="space-y-4 w-full">
        <Card className="w-full border-l-4 border-l-brand min-w-0">
          <CardContent className="p-5 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign size={14} className="flex-shrink-0" />
                Lucro líquido
              </p>
              <div
                className={cn(
                  "text-3xl md:text-4xl font-bold tabular-nums mt-1 whitespace-nowrap",
                  stats.saldo >= 0 ? "text-positive-strong" : "text-negative-strong"
                )}
                title={formatCurrency(stats.saldo)}
              >
                {formatCurrency(stats.saldo)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Receitas menos despesas do período</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Margem</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{margem}%</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
                Receitas totais
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <div
                className="text-base sm:text-lg xl:text-xl font-bold text-positive-strong tabular-nums whitespace-nowrap"
                title={formatCurrency(stats.receitasTotal)}
              >
                {formatCurrency(stats.receitasTotal)}
              </div>
              <p
                className={cn(
                  "text-xs mt-1 flex items-center min-w-0",
                  Number(stats.receitasMes) < 0 ? "text-negative-strong" : "text-muted-foreground"
                )}
              >
                {Number(stats.receitasMes) < 0 ? (
                  <TrendingDown size={12} className="mr-1 flex-shrink-0" />
                ) : (
                  <TrendingUp size={12} className="mr-1 flex-shrink-0" />
                )}
                <span className="truncate">{stats.receitasMes}% vs período anterior</span>
              </p>
            </CardContent>
          </Card>

          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
                Despesas totais
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <div
                className="text-base sm:text-lg xl:text-xl font-bold text-negative-strong tabular-nums whitespace-nowrap"
                title={formatCurrency(stats.despesasTotal)}
              >
                {formatCurrency(stats.despesasTotal)}
              </div>
              <p
                className={cn(
                  "text-xs mt-1 flex items-center min-w-0",
                  Number(stats.despesasMes) > 0 ? "text-negative-strong" : "text-muted-foreground"
                )}
              >
                {Number(stats.despesasMes) > 0 ? (
                  <TrendingUp size={12} className="mr-1 flex-shrink-0" />
                ) : (
                  <TrendingDown size={12} className="mr-1 flex-shrink-0" />
                )}
                <span className="truncate">{stats.despesasMes}% vs período anterior</span>
              </p>
            </CardContent>
          </Card>

          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
                A receber
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <div
                className="text-base sm:text-lg xl:text-xl font-bold text-foreground tabular-nums whitespace-nowrap"
                title={formatCurrency(stats.aReceber.total)}
              >
                {formatCurrency(stats.aReceber.total)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center min-w-0">
                <Clock size={12} className="mr-1 flex-shrink-0" />
                <span className="truncate">{stats.aReceber.count} lançamento(s) pendente(s)</span>
              </p>
            </CardContent>
          </Card>

          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
                A pagar
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <div
                className="text-base sm:text-lg xl:text-xl font-bold text-foreground tabular-nums whitespace-nowrap"
                title={formatCurrency(stats.aPagar.total)}
              >
                {formatCurrency(stats.aPagar.total)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center min-w-0">
                <Clock size={12} className="mr-1 flex-shrink-0" />
                <span className="truncate">{stats.aPagar.count} lançamento(s) pendente(s)</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráfico principal */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={18} className="text-muted-foreground" />
            Fluxo Financeiro
          </CardTitle>
          <CardDescription>
            Comparativo de Receitas x Despesas ({visualizacao === "dia" ? "Diário" : "Mensal"})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full relative">
            {!hasChartData && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <p className="text-muted-foreground text-sm">Sem registros no período</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
                <XAxis
                  dataKey={visualizacao === "dia" ? "dia" : "mes"}
                  stroke="hsl(var(--chart-neutral))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="hsl(var(--chart-neutral))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="receitas"
                  name="Receitas"
                  fill="hsl(var(--chart-success))"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="despesas"
                  name="Despesas"
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

      {/* Detalhamento por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              Detalhamento de Receitas
            </CardTitle>
            <CardDescription>Receitas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[320px] w-full">
              {!hasReceitasData ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Sem registros no período</p>
                </div>
              ) : (
                <DonutChart data={categoriaData} totalLabel="Total" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
              Detalhamento de Despesas
            </CardTitle>
            <CardDescription>Despesas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[320px] w-full">
              {!hasDespesasData ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Sem registros no período</p>
                </div>
              ) : (
                <DonutChart data={despesasCategoriaData} totalLabel="Total" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 lançamentos do período */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-green-600" />
              Top 5 receitas
            </CardTitle>
            <CardDescription>Maiores entradas do período</CardDescription>
          </CardHeader>
          <CardContent>
            {topReceitas.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Sem receitas no período</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {topReceitas.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/10 text-positive-strong text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.descricao}</p>
                      <p className="text-xs text-muted-foreground">{formatDateDisplay(r.data)}</p>
                    </div>
                    <span className="text-sm font-semibold text-positive-strong tabular-nums whitespace-nowrap">
                      {formatCurrency(r.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-red-600" />
              Top 5 despesas
            </CardTitle>
            <CardDescription>Maiores saídas do período</CardDescription>
          </CardHeader>
          <CardContent>
            {topDespesas.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Sem despesas no período</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {topDespesas.map((d, i) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600 text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.descricao}</p>
                      <p className="text-xs text-muted-foreground">{formatDateDisplay(d.data)}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600 tabular-nums whitespace-nowrap">
                      {formatCurrency(d.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
