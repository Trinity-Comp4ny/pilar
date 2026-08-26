import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { curvaSObra } from "@/lib/obras";
import { startOfWeek, toIso } from "@/lib/cronograma";
import { formatDate } from "@/lib/format";
import { useObraTarefas } from "@/hooks/useObraTarefas";
import { useObraRdos } from "@/hooks/useObraRdo";
import { useObraRdoTarefas } from "@/hooks/useObraRdoTarefas";

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0] as { payload: { planejadoPct: number; realizadoPct: number } };
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-ink">{formatDate(label ?? "")}</p>
      <p className="text-info-mid">Planejado: {p.payload.planejadoPct}%</p>
      <p className="text-positive-strong">Realizado: {p.payload.realizadoPct}%</p>
    </div>
  );
}

export function ObraCurvaS({ obraId }: { obraId: string }) {
  const { data: tarefas = [] } = useObraTarefas(obraId);
  const { data: rdos = [] } = useObraRdos(obraId);
  const { data: vinculos = [] } = useObraRdoTarefas(obraId);

  const pontos = useMemo(() => {
    const dataDoRdo = new Map(rdos.map((r) => [r.id, r.data]));
    const concluidasPorRdo = new Map<string, string>();
    for (const v of vinculos) {
      if (v.resultado !== "concluiu") continue;
      const data = dataDoRdo.get(v.rdo_id);
      if (!data) continue;
      const atual = concluidasPorRdo.get(v.tarefa_id);
      if (!atual || data < atual) concluidasPorRdo.set(v.tarefa_id, data);
    }
    return curvaSObra(tarefas, concluidasPorRdo);
  }, [tarefas, rdos, vinculos]);

  if (pontos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Defina prazo nas tarefas do cronograma para ver a curva de planejado × realizado.
        </p>
      </div>
    );
  }

  // A marca "Hoje" tem que cair exatamente numa das semanas amostradas
  // (o eixo X é categórico), por isso usa a segunda-feira da semana atual,
  // não a data crua de hoje.
  const semanaAtual = toIso(startOfWeek(new Date()));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
          <XAxis
            dataKey="semana"
            tickFormatter={(v: string) => formatDate(v)}
            stroke="hsl(var(--chart-neutral))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            stroke="hsl(var(--chart-neutral))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="realizadoPct"
            stroke="hsl(var(--chart-success))"
            fill="hsl(var(--chart-success))"
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="planejadoPct"
            stroke="hsl(var(--chart-info))"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
          <ReferenceLine
            x={semanaAtual}
            stroke="hsl(var(--chart-warning))"
            strokeDasharray="2 2"
            label={{ value: "Hoje", fontSize: 10, position: "top" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
