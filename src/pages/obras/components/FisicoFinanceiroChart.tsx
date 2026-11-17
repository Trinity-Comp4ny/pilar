import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { cn } from "@/lib/utils";
import {
  diferencaPlanejado,
  rotuloMes,
  type MesChave,
  type PontoPlanejadoRealizado,
} from "@/pages/obras/lib/fisicoFinanceiro";

/** Conteúdo do tooltip: mês, acumulado planejado, acumulado realizado e a diferença em R$ e em %. */
export function TooltipPlanejadoRealizado({ ponto }: { ponto: PontoPlanejadoRealizado }) {
  const formatCurrency = useMoneyMask();
  const dif = diferencaPlanejado(ponto);
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-ink">{rotuloMes(ponto.mes)}</p>
      <p className="text-info-mid">Planejado: {formatCurrency(ponto.planejadoAcumulado)}</p>
      <p className="text-danger-strong">
        Realizado: {ponto.realizadoAcumulado == null ? "ainda não" : formatCurrency(ponto.realizadoAcumulado)}
      </p>
      {dif && (
        <p className={cn("mt-1 font-medium", dif.valor > 0 ? "text-danger-strong" : "text-positive-strong")}>
          {dif.valor > 0 ? "Acima do planejado: " : dif.valor < 0 ? "Abaixo do planejado: " : "No planejado: "}
          {formatCurrency(Math.abs(dif.valor))}
          {dif.pct != null && ` (${dif.pct > 0 ? "+" : ""}${dif.pct.toLocaleString("pt-BR")}%)`}
        </p>
      )}
    </div>
  );
}

interface Props {
  pontos: ReadonlyArray<PontoPlanejadoRealizado>;
  /** Mês atual ("YYYY-MM"): onde a marca "Hoje" cai. */
  mesAtual: MesChave;
}

/**
 * Desembolso planejado × realizado, acumulados mês a mês (spec 165). A linha é o planejado a partir do
 * físico-financeiro; a área é o realizado, que para no mês atual.
 */
export function FisicoFinanceiroChart({ pontos, mesAtual }: Props) {
  const formatCurrency = useMoneyMask();
  if (pontos.length === 0) return null;
  const marcaHoje = pontos.some((p) => p.mes === mesAtual);
  const maior = pontos.reduce((m, p) => Math.max(m, p.planejadoAcumulado, p.realizadoAcumulado ?? 0), 0);

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">Planejado × realizado</h3>
        <ul className="flex items-center gap-3 text-xs text-muted-foreground" aria-label="Legenda">
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[hsl(var(--chart-info))]" aria-hidden />
            Planejado
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-[hsl(var(--chart-danger))] opacity-40"
              aria-hidden
            />
            Realizado
          </li>
        </ul>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={[...pontos]} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
            <XAxis
              dataKey="mes"
              tickFormatter={rotuloMes}
              stroke="hsl(var(--chart-neutral))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              domain={[0, maior * 1.1 || 1]}
              tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
              stroke="hsl(var(--chart-neutral))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              content={({ active, payload }) =>
                active && payload && payload.length > 0 ? (
                  <TooltipPlanejadoRealizado ponto={(payload[0] as { payload: PontoPlanejadoRealizado }).payload} />
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="realizadoAcumulado"
              stroke="hsl(var(--chart-danger))"
              fill="hsl(var(--chart-danger))"
              fillOpacity={0.15}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="planejadoAcumulado"
              stroke="hsl(var(--chart-info))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {marcaHoje && (
              <ReferenceLine
                x={mesAtual}
                stroke="hsl(var(--chart-warning))"
                strokeDasharray="2 2"
                label={{ value: "Hoje", fontSize: 10, position: "top" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
