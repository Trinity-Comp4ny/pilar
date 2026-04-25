import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface AlocacaoVsRealProps {
  weekStart: string;
  weekEnd: string;
}

export function AlocacaoVsReal({ weekStart, weekEnd }: AlocacaoVsRealProps) {
  const { data: pessoas = [] } = useQuery({
    queryKey: ["pessoas-alocvsreal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome, horas_semanais")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: alocacoes = [], isLoading: loadAloc } = useQuery({
    queryKey: ["alocacoes-vsreal", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alocacoes")
        .select("pessoa_id, horas_alocadas, semana_inicio")
        .gte("semana_inicio", weekStart)
        .lte("semana_inicio", weekEnd);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
  });

  const { data: timesheets = [], isLoading: loadTs } = useQuery({
    queryKey: ["timesheets-vsreal", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("pessoa_id, horas")
        .gte("data", weekStart)
        .lte("data", weekEnd)
        .in("status", ["aprovado", "pendente"])
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
  });

  const chartData = useMemo(() => {
    // Horas alocadas por pessoa
    const alocMap = new Map<string, number>();
    for (const a of alocacoes) {
      const pid = a.pessoa_id;
      alocMap.set(pid, (alocMap.get(pid) || 0) + Number(a.horas_alocadas));
    }

    // Horas reais por pessoa
    const realMap = new Map<string, number>();
    for (const t of timesheets) {
      const pid = t.pessoa_id;
      realMap.set(pid, (realMap.get(pid) || 0) + Number(t.horas));
    }

    return pessoas
      .map((p) => {
        const planejado = alocMap.get(p.id) || 0;
        const real = realMap.get(p.id) || 0;
        if (planejado === 0 && real === 0) return null;
        return {
          nome: p.nome.split(" ").slice(0, 2).join(" "),
          planejado: Math.round(planejado * 10) / 10,
          real: Math.round(real * 10) / 10,
          delta: Math.round((real - planejado) * 10) / 10,
        };
      })
      .filter(Boolean) as Array<{ nome: string; planejado: number; real: number; delta: number }>;
  }, [pessoas, alocacoes, timesheets]);

  const isLoading = loadAloc || loadTs;

  const totalPlanejado = chartData.reduce((s, d) => s + d.planejado, 0);
  const totalReal = chartData.reduce((s, d) => s + d.real, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Planejado vs Real</CardTitle>
          <div className="flex gap-3 text-xs">
            <Badge variant="secondary">Planejado: {totalPlanejado.toFixed(0)}h</Badge>
            <Badge className="bg-blue-100 text-blue-800">Real: {totalReal.toFixed(0)}h</Badge>
            <Badge
              className={totalReal > totalPlanejado ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}
            >
              Delta: {totalReal - totalPlanejado > 0 ? "+" : ""}
              {(totalReal - totalPlanejado).toFixed(0)}h
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma alocação ou timesheet registrado no período selecionado.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 45)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v}h`} />
              <Legend fontSize={11} />
              <Bar
                dataKey="planejado"
                name="Planejado"
                fill="hsl(var(--chart-neutral))"
                barSize={14}
                radius={[0, 3, 3, 0]}
              />
              <Bar dataKey="real" name="Real" fill="hsl(var(--chart-info))" barSize={14} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
