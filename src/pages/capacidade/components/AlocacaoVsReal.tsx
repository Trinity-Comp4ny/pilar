import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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

  const { data: alocacoes = [], isLoading } = useQuery({
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

  const chartData = useMemo(() => {
    const alocMap = new Map<string, number>();
    for (const a of alocacoes) {
      const pid = a.pessoa_id;
      alocMap.set(pid, (alocMap.get(pid) || 0) + Number(a.horas_alocadas));
    }

    return pessoas
      .map((p) => {
        const planejado = alocMap.get(p.id) || 0;
        if (planejado === 0) return null;
        return {
          nome: p.nome.split(" ").slice(0, 2).join(" "),
          planejado: Math.round(planejado * 10) / 10,
        };
      })
      .filter(Boolean) as Array<{ nome: string; planejado: number }>;
  }, [pessoas, alocacoes]);

  const totalPlanejado = chartData.reduce((s, d) => s + d.planejado, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Horas Planejadas</CardTitle>
          <Badge variant="secondary">Total: {totalPlanejado.toFixed(0)}h</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma alocação registrada no período selecionado.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 45)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v}h`} />
              <Bar
                dataKey="planejado"
                name="Planejado"
                fill="hsl(var(--chart-neutral))"
                barSize={14}
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
