import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "recharts";
import { CustomTooltip } from "../components/CustomTooltip";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useFinanceFilter } from "../hooks/useFinanceFilter";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

function VisaoGeralSkeleton() {
  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
        {[1, 2, 3, 4, 5].map((i) => (
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
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {[1, 2].map((i) => (
          <Card key={i} className="vrz-card w-full">
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
          <text
            x="50%"
            y="47%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight={600}
            fill="hsl(220 9% 46%)"
            style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            {totalLabel}
          </text>
          <text
            x="50%"
            y="56%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13}
            fontWeight={700}
            fill="hsl(0 0% 10%)"
          >
            {formatCurrency(total)}
          </text>
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="bottom" height={36} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function VisaoGeral() {
  const { visualizacao, dateFrom, dateTo } = useFinanceFilter();
  const { data: dashboardData, isLoading } = useFinanceData(dateFrom, dateTo);

  if (isLoading) return <VisaoGeralSkeleton />;

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
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
        <Card className="vrz-card bg-positive/10 border-positive/10 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 truncate">Receitas Totais</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-green-700 tabular-nums truncate">
              {formatCurrency(stats.receitasTotal)}
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center min-w-0">
              <ArrowUpRight size={12} className="mr-1 flex-shrink-0" />
              <span className="truncate">{stats.receitasMes}% vs período anterior</span>
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card bg-red-50 border-red-100 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 truncate">Despesas Totais</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-red-700 tabular-nums truncate">
              {formatCurrency(stats.despesasTotal)}
            </div>
            <p
              className={`text-xs mt-1 flex items-center min-w-0 ${Number(stats.despesasMes) > 0 ? "text-red-600" : "text-green-600"}`}
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

        <Card className="vrz-card bg-blue-50 border-blue-100 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 truncate">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-blue-700 tabular-nums truncate">
              {formatCurrency(stats.saldo)}
            </div>
            <p className="text-xs text-blue-600 mt-1 flex items-center min-w-0">
              <DollarSign size={12} className="mr-1 flex-shrink-0" />
              <span className="truncate">Margem de {margem}%</span>
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card bg-emerald-50 border-emerald-100 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800 truncate">A receber</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-emerald-700 tabular-nums truncate">
              {formatCurrency(stats.aReceber.total)}
            </div>
            <p className="text-xs text-emerald-600 mt-1 flex items-center min-w-0">
              <Clock size={12} className="mr-1 flex-shrink-0" />
              <span className="truncate">{stats.aReceber.count} lançamento(s) pendente(s)</span>
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card bg-amber-50 border-amber-100 w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800 truncate">A pagar</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-amber-700 tabular-nums truncate">
              {formatCurrency(stats.aPagar.total)}
            </div>
            <p className="text-xs text-amber-600 mt-1 flex items-center min-w-0">
              <Clock size={12} className="mr-1 flex-shrink-0" />
              <span className="truncate">{stats.aPagar.count} lançamento(s) pendente(s)</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico principal */}
      <Card className="vrz-card w-full">
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
                <p className="text-muted-foreground text-sm">Não possui registros de dados ainda</p>
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

      {/* Detalhamento por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              Detalhamento de Entradas
            </CardTitle>
            <CardDescription>Receitas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[320px] w-full">
              {!hasReceitasData ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Não possui registros de dados ainda</p>
                </div>
              ) : (
                <DonutChart data={categoriaData} totalLabel="Total" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
              Detalhamento de Saídas
            </CardTitle>
            <CardDescription>Despesas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[320px] w-full">
              {!hasDespesasData ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Não possui registros de dados ainda</p>
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
        <Card className="vrz-card w-full">
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
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/10 text-positive text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.descricao}</p>
                      <p className="text-xs text-muted-foreground">{formatDateDisplay(r.data)}</p>
                    </div>
                    <span className="text-sm font-semibold text-positive tabular-nums whitespace-nowrap">
                      {formatCurrency(r.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
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
