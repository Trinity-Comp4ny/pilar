import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, DollarSign, BarChart3, Loader2 } from "lucide-react";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Area, PieChart, Pie, Cell } from "recharts";
import MetasSummary from "../components/MetasSummary";
import { CustomTooltip } from "../components/CustomTooltip";
import { useDashboardData } from "@/hooks/useDashboardData";

interface VisaoGeralProps {
  visualizacao: "dia" | "mes" | "ano";
  dateFrom?: Date;
  dateTo?: Date;
}

export default function VisaoGeral({ visualizacao, dateFrom, dateTo }: VisaoGeralProps) {
  const { data: dashboardData, isLoading } = useDashboardData(dateFrom, dateTo);

  if (isLoading) {
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
    saldo: 0
  };

  const chartData = visualizacao === 'dia'
    ? (dashboardData?.chartDataDiario || [])
    : (dashboardData?.chartData || []);

  const categoriaData = dashboardData?.categoriaData || [];
  const despesasCategoriaData = dashboardData?.despesasCategoriaData || [];

  const hasChartData = chartData.some(item => item.receitas > 0 || item.despesas > 0);
  const hasReceitasData = categoriaData.length > 0;
  const hasDespesasData = despesasCategoriaData.length > 0;

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        <Card className="vrz-card w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-black/60">Receitas Totais</CardTitle>
            <div className="p-2 rounded-full bg-green-100 text-green-600">
              <ArrowUpRight size={18} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receitasTotal)}
            </div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp size={12} />
              {stats.receitasMes}% vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-black/60">Despesas Totais</CardTitle>
            <div className="p-2 rounded-full bg-red-100 text-red-600">
              <ArrowDownRight size={18} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.despesasTotal)}
            </div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingDown size={12} />
              {stats.despesasMes}% vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-black/60">Saldo Líquido</CardTitle>
            <div className="p-2 rounded-full bg-blue-100 text-blue-600">
              <DollarSign size={18} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.saldo)}
            </div>
            <p className="text-xs text-black/50 mt-1">
              Margem de Lucro: {stats.receitasTotal > 0 ? ((stats.saldo / stats.receitasTotal) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Layout Principal: Metas + Gráfico */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 w-full">
        {/* Gráfico Principal - Maior */}
        <Card className="vrz-card xl:col-span-4 w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} />
              Fluxo Financeiro
            </CardTitle>
            <CardDescription>Comparativo de Receitas x Despesas ({visualizacao === 'dia' ? 'Diário' : 'Mensal'})</CardDescription>
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
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-success))" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="hsl(var(--chart-success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-danger))" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="hsl(var(--chart-danger))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey={visualizacao === 'dia' ? 'dia' : 'mes'}
                    stroke="#888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${value / 1000}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas"
                    stroke="hsl(var(--chart-success))"
                    fillOpacity={1}
                    fill="url(#colorReceitas)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas"
                    stroke="hsl(var(--chart-danger))"
                    fillOpacity={1}
                    fill="url(#colorDespesas)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metas Summary - Menor */}
      <div className="xl:col-span-1 h-full w-full">
        <div className="h-full w-full">
          <MetasSummary />
        </div>
      </div>

      {/* Detalhamento de Entradas e Saídas - Gráficos de Rosca */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
              Detalhamento de Entradas
            </CardTitle>
            <CardDescription>Receitas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[320px] w-full">
              {!hasReceitasData && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                  <p className="text-muted-foreground text-sm">Não possui registros de dados ainda</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoriaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-red-600" />
              Detalhamento de Saídas
            </CardTitle>
            <CardDescription>Despesas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[320px] w-full">
              {!hasDespesasData && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                  <p className="text-muted-foreground text-sm">Não possui registros de dados ainda</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={despesasCategoriaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {despesasCategoriaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
