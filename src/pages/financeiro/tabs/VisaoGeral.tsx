import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
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
  AreaChart,
  Area,
} from "recharts";
import { CustomTooltip } from "../components/CustomTooltip";
import { useFinanceData } from "@/hooks/useFinanceData";

interface VisaoGeralProps {
  visualizacao: "dia" | "mes" | "ano";
  dateFrom?: Date;
  dateTo?: Date;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const formatVariation = (raw: string | number) => {
  const value = Number(raw);
  if (!Number.isFinite(value) || value === 0) return { label: "estável", up: false, neutral: true };
  if (Math.abs(value) > 999) return { label: ">999%", up: value > 0, neutral: false };
  return { label: `${value > 0 ? "+" : ""}${value.toFixed(1)}%`, up: value > 0, neutral: false };
};

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
  sparkData: Array<{ value: number }>;
  sparkColor: string;
  variation?: { label: string; up: boolean; neutral: boolean; goodWhenUp: boolean };
  footer?: React.ReactNode;
}

function KpiCard({ label, value, icon, iconBg, valueColor, sparkData, sparkColor, variation, footer }: KpiCardProps) {
  const trendColor = variation
    ? variation.neutral
      ? "text-muted-foreground"
      : variation.up === variation.goodWhenUp
        ? "text-emerald-600"
        : "text-red-600"
    : "text-muted-foreground";

  return (
    <Card className="vrz-card w-full overflow-hidden relative">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <div className={`p-2 rounded-full ${iconBg}`}>{icon}</div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className={`text-3xl font-bold tabular-nums ${valueColor}`}>{formatCurrency(value)}</div>
        {variation && (
          <p className={`text-xs flex items-center gap-1 mt-1 font-medium ${trendColor}`}>
            {variation.neutral ? (
              <span className="opacity-60">—</span>
            ) : variation.up ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {variation.label} <span className="text-muted-foreground font-normal">vs período anterior</span>
          </p>
        )}
        {footer}
      </CardContent>
      <div className="h-12 -mt-2 px-1 opacity-90">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={sparkColor}
              strokeWidth={2}
              fill={`url(#spark-${label})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function VisaoGeralSkeleton() {
  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="vrz-card w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-12 w-full mt-3" />
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
  totalColor: string;
}

function DonutChart({ data, totalLabel, totalColor }: DonutProps) {
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
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider"
          >
            {totalLabel}
          </text>
          <text
            x="50%"
            y="56%"
            textAnchor="middle"
            dominantBaseline="middle"
            className={`text-base font-bold tabular-nums ${totalColor}`}
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

export default function VisaoGeral({ visualizacao, dateFrom, dateTo }: VisaoGeralProps) {
  const { data: dashboardData, isLoading } = useFinanceData(dateFrom, dateTo);

  if (isLoading) return <VisaoGeralSkeleton />;

  const stats = dashboardData?.stats || {
    receitasTotal: 0,
    receitasMes: 0,
    despesasTotal: 0,
    despesasMes: 0,
    saldo: 0,
  };

  const chartData = visualizacao === "dia" ? dashboardData?.chartDataDiario || [] : dashboardData?.chartData || [];
  const chartDataDiario = dashboardData?.chartDataDiario || [];

  const categoriaData = dashboardData?.categoriaData || [];
  const despesasCategoriaData = dashboardData?.despesasCategoriaData || [];

  const hasChartData = chartData.some((item) => item.receitas > 0 || item.despesas > 0);
  const hasReceitasData = categoriaData.length > 0;
  const hasDespesasData = despesasCategoriaData.length > 0;

  const receitasSpark = chartDataDiario.map((d) => ({ value: d.receitas }));
  const despesasSpark = chartDataDiario.map((d) => ({ value: d.despesas }));
  const saldoSpark = chartDataDiario.map((d) => ({ value: d.receitas - d.despesas }));

  const receitasVar = { ...formatVariation(stats.receitasMes), goodWhenUp: true };
  const despesasVar = { ...formatVariation(stats.despesasMes), goodWhenUp: false };
  const margem = stats.receitasTotal > 0 ? (stats.saldo / stats.receitasTotal) * 100 : 0;

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        <KpiCard
          label="Receitas Totais"
          value={stats.receitasTotal}
          icon={<ArrowUpRight size={18} className="text-emerald-600" />}
          iconBg="bg-emerald-100"
          valueColor="text-emerald-600"
          sparkData={receitasSpark}
          sparkColor="hsl(142 71% 45%)"
          variation={receitasVar}
        />

        <KpiCard
          label="Despesas Totais"
          value={stats.despesasTotal}
          icon={<ArrowDownRight size={18} className="text-red-600" />}
          iconBg="bg-red-100"
          valueColor="text-red-600"
          sparkData={despesasSpark}
          sparkColor="hsl(0 84% 60%)"
          variation={despesasVar}
        />

        <KpiCard
          label="Saldo Líquido"
          value={stats.saldo}
          icon={<DollarSign size={18} className="text-blue-600" />}
          iconBg="bg-blue-100"
          valueColor={stats.saldo >= 0 ? "text-blue-600" : "text-red-600"}
          sparkData={saldoSpark}
          sparkColor="hsl(217 91% 60%)"
          footer={
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Margem de Lucro: <span className="text-foreground font-semibold">{margem.toFixed(1)}%</span>
            </p>
          }
        />
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
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
                <DonutChart data={categoriaData} totalLabel="Total Receitas" totalColor="fill-emerald-600" />
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
                <DonutChart data={despesasCategoriaData} totalLabel="Total Despesas" totalColor="fill-red-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
