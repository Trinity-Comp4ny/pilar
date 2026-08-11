import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import type { StatusTone } from "@/lib/status";
import {
  Target,
  TrendingUp,
  Users,
  Calendar,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string | null;
  categoria: string | null;
  tipo: string;
  pessoa_id: string | null;
  projeto_id: string | null;
}

export default function MetasDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meta[];
    },
  });

  // Acompanhamento automático: rpc_sync_metas atualiza o valor "atual" das metas
  // com auto_sync=true a partir das fontes (receita, projetos, margem...).
  const sync = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rpc_sync_metas");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-all"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível atualizar as metas",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  // Sincroniza uma vez ao abrir o dashboard.
  useEffect(() => {
    sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allMetas = metas ?? [];
  const financeiras = allMetas.filter((m) => (m.tipo ?? "financeira") === "financeira");
  const pessoais = allMetas.filter((m) => m.tipo === "pessoal");
  const projetos = allMetas.filter((m) => m.tipo === "projeto");

  const calcStats = (items: Meta[]) => {
    if (items.length === 0) return { total: 0, completed: 0, avgProgress: 0, overdue: 0 };
    const completed = items.filter((m) => m.atual >= m.alvo).length;
    const avgProgress = Math.round(
      items.reduce((acc, m) => acc + Math.min((m.atual / m.alvo) * 100, 100), 0) / items.length
    );
    const overdue = items.filter((m) => m.prazo && new Date(m.prazo) < new Date() && m.atual < m.alvo).length;
    return { total: items.length, completed, avgProgress, overdue };
  };

  const stats = calcStats(allMetas);
  const finStats = calcStats(financeiras);
  const pesStats = calcStats(pessoais);
  const projStats = calcStats(projetos);

  const chartData = [
    { name: "Financeiras", total: finStats.total, concluidas: finStats.completed, progresso: finStats.avgProgress },
    { name: "Pessoais", total: pesStats.total, concluidas: pesStats.completed, progresso: pesStats.avgProgress },
    { name: "Projetos", total: projStats.total, concluidas: projStats.completed, progresso: projStats.avgProgress },
  ];

  const summaryCards: { label: string; value: string; icon: typeof Target; tone: StatusTone }[] = [
    { label: "Total de Metas", value: stats.total.toString(), icon: Target, tone: "neutral" },
    { label: "Concluídas", value: stats.completed.toString(), icon: CheckCircle2, tone: "positive" },
    { label: "Progresso Médio", value: `${stats.avgProgress}%`, icon: Clock, tone: "neutral" },
    { label: "Atrasadas", value: stats.overdue.toString(), icon: AlertTriangle, tone: "danger" },
  ];

  const topMetas = [...allMetas]
    .sort((a, b) => {
      const pa = Math.min((a.atual / a.alvo) * 100, 100);
      const pb = Math.min((b.atual / b.alvo) * 100, 100);
      return pb - pa;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Metas com sincronização automática são atualizadas pelas suas fontes (receita, projetos, margem).
        </p>
        <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <KPICard key={card.label} icon={card.icon} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chart - Metas por Tipo */}
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Metas por Categoria</CardTitle>
            <CardDescription>Comparativo de progresso por tipo de meta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--brand-accent))" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="concluidas"
                    name="Concluídas"
                    fill="hsl(var(--chart-success-alt))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Metas */}
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Top 5 Metas</CardTitle>
            <CardDescription>Metas com maior progresso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topMetas.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhuma meta cadastrada</p>
            ) : (
              topMetas.map((meta) => {
                const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
                const tipoLabel =
                  (meta.tipo ?? "financeira") === "financeira"
                    ? "Financeira"
                    : meta.tipo === "pessoal"
                      ? "Pessoal"
                      : "Projeto";
                return (
                  <div key={meta.id} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{meta.nome}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {tipoLabel}
                        </span>
                      </div>
                      <span className="text-sm font-bold">{percent}%</span>
                    </div>
                    <Progress
                      value={percent}
                      className="h-2 bg-gray-100"
                      indicatorClassName={percent >= 100 ? "bg-positive/100" : "bg-brand"}
                    />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo por tipo */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            label: "Financeiras",
            icon: TrendingUp,
            stats: finStats,
            color: "text-positive-strong",
            bg: "bg-positive/10",
          },
          { label: "Pessoais", icon: Users, stats: pesStats, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Projetos", icon: Calendar, stats: projStats, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${item.bg}`}>
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.stats.total} metas</p>
                  </div>
                </div>
                <Progress
                  value={item.stats.avgProgress}
                  className="h-2 bg-gray-100"
                  indicatorClassName={item.stats.avgProgress >= 100 ? "bg-positive/100" : "bg-brand"}
                />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{item.stats.completed} concluídas</span>
                  <span>{item.stats.avgProgress}% progresso</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
