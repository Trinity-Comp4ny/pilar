import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown } from "lucide-react";
import { desembolsoAcumuladoPorMes } from "@/lib/obras";
import { formatCurrency } from "@/lib/format";
import type { ObraLancamentoRow } from "@/hooks/useObraConta";
import type { ObraOrcamentoRow } from "@/hooks/useObraOrcamento";

function mesLabel(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${ano.slice(2)}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0] as { payload: { acumuladoRealizado: number } };
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-ink">{mesLabel(label ?? "")}</p>
      <p className="text-danger-strong">Desembolsado: {formatCurrency(p.payload.acumuladoRealizado)}</p>
    </div>
  );
}

export function ObraDesembolsoChart({
  lancamentos,
  orcamentos,
}: {
  lancamentos: ObraLancamentoRow[];
  orcamentos: ObraOrcamentoRow[];
}) {
  const pontos = useMemo(() => desembolsoAcumuladoPorMes(lancamentos), [lancamentos]);
  const previstoTotal = useMemo(() => orcamentos.reduce((acc, o) => acc + Number(o.valor_previsto), 0), [orcamentos]);
  // O eixo Y tem que cobrir a linha de referência também: sem isso, um previsto
  // bem maior que o realizado até agora fica fora da área visível do gráfico.
  const maiorRealizado = pontos.reduce((max, p) => Math.max(max, p.acumuladoRealizado), 0);
  const domainMax = Math.max(maiorRealizado, previstoTotal) * 1.1;

  if (pontos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        <TrendingDown className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Lance despesas para ver o desembolso ao longo do tempo.</p>
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
          <XAxis
            dataKey="mes"
            tickFormatter={mesLabel}
            stroke="hsl(var(--chart-neutral))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, domainMax]}
            tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
            stroke="hsl(var(--chart-neutral))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="acumuladoRealizado"
            stroke="hsl(var(--chart-danger))"
            fill="hsl(var(--chart-danger))"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          {previstoTotal > 0 && (
            <ReferenceLine
              y={previstoTotal}
              stroke="hsl(var(--chart-warning))"
              strokeDasharray="4 3"
              label={{
                value: `Orçamento previsto: ${formatCurrency(previstoTotal, { compact: true })}`,
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
