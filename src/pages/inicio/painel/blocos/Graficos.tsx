import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráficos temporais do painel (SPEC 092), em recharts (a lib já instalada,
 * ADR 0008: problema universal usa a biblioteca do projeto).
 *
 * Paleta: UMA série em `--chart-info`, contraponto em `--chart-neutral`,
 * referência tracejada em cinza. Verde e vermelho não entram como paleta de
 * série; eles ficam reservados para o divergente de horas, onde o sinal do
 * número é literalmente bom ou ruim.
 *
 * Regras de leitura aplicadas em todos:
 * - Uma escala por painel. A conversão é DOIS gráficos empilhados que
 *   compartilham o eixo x, nunca dois eixos y no mesmo gráfico.
 * - Grade recessiva e mínima; referência (meta, média) tracejada.
 * - Cor sempre por token de `--chart-*`.
 */

const EIXO = { fontSize: 10.5, fill: "hsl(var(--text-muted))" };
const GRID = "hsl(var(--chart-grid))";

function CaixaTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-sm">{children}</div>
  );
}

const mesCurto = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

/* ── Conversão mês a mês ──────────────────────────────────────────────────
 * Painel de cima: contagem de propostas decididas (ganhas/perdidas).
 * Painel de baixo: a taxa, em escala própria de 0 a 100%.
 */
export function ConversaoMensalChart({
  dados,
}: {
  dados: { mes: string; ganhas: number; perdidas: number }[];
}) {
  const linhas = useMemo(
    () =>
      dados.map((d) => {
        const total = d.ganhas + d.perdidas;
        return {
          mes: mesCurto(d.mes),
          ganhas: d.ganhas,
          perdidas: d.perdidas,
          taxa: total > 0 ? Math.round((d.ganhas / total) * 100) : null,
          total,
        };
      }),
    [dados]
  );

  return (
    <div className="flex flex-col">
      <p className="mb-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">
        propostas decididas no mês
      </p>
      <ResponsiveContainer width="100%" height={132}>
        <BarChart data={linhas} margin={{ top: 4, right: 8, left: -22, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" tick={false} axisLine={false} height={0} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as (typeof linhas)[number];
              return (
                <CaixaTooltip>
                  <p className="mb-0.5 font-medium text-ink">{label}</p>
                  <p className="text-ink-soft">{p.ganhas} ganhas</p>
                  <p className="text-muted-foreground">{p.perdidas} perdidas</p>
                  {p.taxa !== null && <p className="mt-0.5 text-ink-soft">{p.taxa}% de conversão</p>}
                </CaixaTooltip>
              );
            }}
          />
          <Bar dataKey="ganhas" stackId="d" fill="hsl(var(--chart-info))" radius={[0, 0, 3, 3]} />
          <Bar dataKey="perdidas" stackId="d" fill="hsl(var(--chart-neutral))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <p className="mb-1 mt-2 text-[10.5px] uppercase tracking-wide text-muted-foreground">
        taxa de conversão
      </p>
      <ResponsiveContainer width="100%" height={64}>
        <LineChart data={linhas} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" tick={EIXO} axisLine={false} tickLine={false} interval={0} />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as (typeof linhas)[number];
              if (p.taxa === null) return null;
              return (
                <CaixaTooltip>
                  <p className="font-medium text-ink">{label}</p>
                  <p className="text-info-mid">{p.taxa}% de conversão</p>
                </CaixaTooltip>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="taxa"
            stroke="hsl(var(--chart-info))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Pontualidade contra a meta ─────────────────────────────────────────── */
export function PontualidadeChart({
  dados,
  meta = 85,
}: {
  dados: { mes: string; pct: number | null; total: number }[];
  meta?: number;
}) {
  const linhas = useMemo(
    () => dados.map((d) => ({ mes: mesCurto(d.mes), pct: d.pct, total: d.total })),
    [dados]
  );

  return (
    <ResponsiveContainer width="100%" height={168}>
      <AreaChart data={linhas} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-pontualidade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-info))" stopOpacity={0.22} />
            <stop offset="100%" stopColor="hsl(var(--chart-info))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="mes" tick={EIXO} axisLine={false} tickLine={false} interval={1} />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={EIXO}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        <ReferenceLine
          y={meta}
          stroke="hsl(var(--chart-neutral))"
          strokeDasharray="5 4"
          strokeWidth={1.5}
          label={{ value: `meta ${meta}%`, position: "insideTopRight", fontSize: 10.5, fill: "hsl(var(--text-muted))" }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]?.payload as (typeof linhas)[number];
            if (p.pct === null) return <CaixaTooltip><p className="text-ink-soft">{label}: nada concluído</p></CaixaTooltip>;
            return (
              <CaixaTooltip>
                <p className="mb-0.5 font-medium text-ink">{label}</p>
                <p className="text-info-mid">{p.pct}% no prazo</p>
                <p className="text-ink-soft">
                  {p.total} projeto{p.total === 1 ? "" : "s"} concluído{p.total === 1 ? "" : "s"}
                </p>
              </CaixaTooltip>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="pct"
          stroke="hsl(var(--chart-info))"
          strokeWidth={2}
          fill="url(#grad-pontualidade)"
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Ritmo de entrega contra a média ────────────────────────────────────── */
export function ThroughputChart({
  dados,
  media,
}: {
  dados: { semana: string; n: number }[];
  media: number | null;
}) {
  const linhas = useMemo(
    () =>
      dados.map((d, i) => ({
        rotulo: i === dados.length - 1 ? "atual" : "",
        semana: new Date(`${d.semana}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        n: d.n,
        abaixo: media !== null && d.n < media,
      })),
    [dados, media]
  );

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={linhas} margin={{ top: 8, right: 34, left: -24, bottom: 0 }} barCategoryGap="26%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
        {media !== null && (
          <ReferenceLine
            y={media}
            stroke="hsl(var(--chart-neutral))"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{ value: `média ${media}`, position: "right", fontSize: 10.5, fill: "hsl(var(--text-muted))" }}
          />
        )}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]?.payload as (typeof linhas)[number];
            return (
              <CaixaTooltip>
                <p className="mb-0.5 font-medium text-ink">semana de {p.semana}</p>
                <p className="text-ink-soft">
                  {p.n} tarefa{p.n === 1 ? "" : "s"} concluída{p.n === 1 ? "" : "s"}
                </p>
                {p.abaixo && <p className="text-muted-foreground">abaixo da média</p>}
              </CaixaTooltip>
            );
          }}
        />
        <Bar dataKey="n" radius={[4, 4, 0, 0]}>
          {linhas.map((l, i) => (
            <Cell key={i} fill={l.abaixo ? "hsl(var(--chart-neutral))" : "hsl(var(--chart-info))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
