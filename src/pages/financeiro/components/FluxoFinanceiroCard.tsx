import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import { BarChart3 } from "lucide-react";
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
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { CustomTooltip } from "./CustomTooltip";
import type { PendenciaMes } from "../hooks/usePendenciasMensais";

export type GraficoView = "comparativo" | "performance" | "pendencias" | "margem";

const GRAFICO_OPCOES: ViewOption<GraficoView>[] = [
  { value: "comparativo", label: "Comparativo" },
  { value: "performance", label: "Performance" },
  { value: "pendencias", label: "A receber x a pagar" },
  { value: "margem", label: "Margem" },
];

interface SerieFluxo {
  mes?: string;
  dia?: string;
  receitas: number;
  despesas: number;
}

interface Props {
  chartView: GraficoView;
  onChartViewChange: (v: GraficoView) => void;
  visualizacao: string;
  chartData: SerieFluxo[];
  chartDataDiario: SerieFluxo[];
  pendencias: PendenciaMes[];
  margemMensal: { mes: string; margem: number }[];
}

/** Card "Fluxo Financeiro" da Visão Geral: comparativo, performance, a receber x a pagar e margem. */
export function FluxoFinanceiroCard({
  chartView,
  onChartViewChange,
  visualizacao,
  chartData,
  chartDataDiario,
  pendencias,
  margemMensal,
}: Props) {
  const hasChartData = chartData.some((item) => item.receitas > 0 || item.despesas > 0);
  const hasDailyData = chartDataDiario.some((item) => item.receitas > 0 || item.despesas > 0);
  const hasMargemData = margemMensal.some((d) => d.margem !== 0);
  const hasPendencias = pendencias.some((p) => p.aReceber > 0 || p.aPagar > 0);
  const setChartView = onChartViewChange;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={18} className="text-muted-foreground" />
            Fluxo Financeiro
          </CardTitle>
          <CardDescription>
            {chartView === "comparativo"
              ? `Comparativo de Receitas x Despesas (${visualizacao === "dia" ? "Diário" : "Mensal"})`
              : chartView === "performance"
                ? "Receitas e despesas acumuladas ao longo do período"
                : chartView === "pendencias"
                  ? "A receber e a pagar por mês de vencimento (pendentes e atrasados)"
                  : "Margem líquida por mês: (receitas − despesas) ÷ receitas"}
          </CardDescription>
        </div>
        <ViewSwitcher
          options={GRAFICO_OPCOES}
          value={chartView}
          onChange={setChartView}
          ariaLabel="Tipo de gráfico"
          className="self-start"
        />
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full relative">
          {chartView === "comparativo" ? (
            <>
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
            </>
          ) : chartView === "pendencias" ? (
            <>
              {!hasPendencias && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                  <p className="text-muted-foreground text-sm">Nada a receber ou a pagar nos próximos meses</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pendencias}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    stroke="hsl(var(--chart-neutral))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="hsl(var(--chart-neutral))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="aReceber"
                    name="A receber"
                    fill="hsl(var(--chart-success))"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="aPagar"
                    name="A pagar"
                    fill="hsl(var(--chart-danger))"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          ) : chartView === "margem" ? (
            <>
              {!hasMargemData && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                  <p className="text-muted-foreground text-sm">Sem registros no período</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={margemMensal}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
                  <XAxis
                    dataKey="mes"
                    stroke="hsl(var(--chart-neutral))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--chart-neutral))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip formatter={(v: number) => formatPercent(v)} />
                  <Area
                    type="monotone"
                    dataKey="margem"
                    name="Margem"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              {!hasDailyData && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                  <p className="text-muted-foreground text-sm">Sem registros no período</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDataDiario}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
                  <XAxis
                    dataKey="dia"
                    stroke="hsl(var(--chart-neutral))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis stroke="hsl(var(--chart-neutral))" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas"
                    stackId="1"
                    stroke="hsl(var(--chart-success))"
                    fill="hsl(var(--chart-success))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas"
                    stackId="2"
                    stroke="hsl(var(--chart-danger))"
                    fill="hsl(var(--chart-danger))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
