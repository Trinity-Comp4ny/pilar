import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const toCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface ChartDatum {
  mes: string;
  Receitas: number;
  Despesas: number;
}

interface RelatoriosChartProps {
  chartData: ChartDatum[];
  tipoRelatorio: string;
}

// Gráfico isolado num chunk próprio: recharts (~pesado) só é baixado quando há
// dados suficientes para renderizar, via React.lazy no componente pai.
export default function RelatoriosChart({ chartData, tipoRelatorio }: RelatoriosChartProps) {
  const hasBoth = tipoRelatorio === "financeiro";

  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">Evolução mensal</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
          <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v)
            }
          />
          <Tooltip
            formatter={(value: number) => toCurrency(value)}
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--chart-grid))" }}
          />
          {tipoRelatorio !== "despesas" && (
            <Bar dataKey="Receitas" fill="hsl(var(--chart-success-alt))" radius={[4, 4, 0, 0]} />
          )}
          {tipoRelatorio !== "receitas" && (
            <Bar dataKey="Despesas" fill="hsl(var(--chart-danger))" radius={[4, 4, 0, 0]} />
          )}
          {hasBoth && <Legend />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
