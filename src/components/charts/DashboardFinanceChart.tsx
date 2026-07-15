// Componente extraído do Dashboard para diferir o bundle do recharts (116 kB gzip).
// Importado via lazy() no Dashboard.tsx.
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { CustomTooltip } from "@/pages/financeiro/components/CustomTooltip";

const fmtCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

interface ChartDataPoint {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface DashboardFinanceChartProps {
  data: ChartDataPoint[];
}

export default function DashboardFinanceChart({ data }: DashboardFinanceChartProps) {
  const hasData = data.some((d) => d.receitas > 0 || d.despesas > 0);

  if (!hasData) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Sem dados no período</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="gReceitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-success))" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(var(--chart-success))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gDespesas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-danger))" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(var(--chart-danger))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
        <XAxis
          dataKey="mes"
          stroke="hsl(var(--chart-neutral))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--chart-neutral))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmtCompact.format(v)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="receitas"
          name="Receitas"
          stroke="hsl(var(--chart-success))"
          fill="url(#gReceitas)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="despesas"
          name="Despesas"
          stroke="hsl(var(--chart-danger))"
          fill="url(#gDespesas)"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="saldo"
          name="Saldo"
          stroke="hsl(var(--c-indigo-500))"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
