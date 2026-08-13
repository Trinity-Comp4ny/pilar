import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { KPICard } from "@/components/KPICard";
import type { StatusTone } from "@/lib/status";
import { Target, TrendingUp, Users, Loader2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchPessoasLookup } from "@/lib/supabaseQueries";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MetaCard } from "../components/MetaCard";
import { MetaFormDialog, type MetaRow, type MetaTipo } from "../components/MetaFormDialog";

export default function MetasDashboard() {
  const queryClient = useQueryClient();

  const [editingMeta, setEditingMeta] = useState<MetaRow | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<string | null>(null);

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MetaRow[];
    },
  });

  const { data: pessoas } = useQuery({
    queryKey: ["pessoas-list"],
    queryFn: fetchPessoasLookup,
  });
  const pessoaMap = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));

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
      toast.error("Não foi possível atualizar as metas", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-all"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setDeleteOpen(false);
      setMetaToDelete(null);
      toast.success("Meta excluída", { description: "Meta removida." });
    },
    onError: () => {
      toast.error("Erro ao excluir");
    },
  });

  // Sincronização automática: ao abrir e a cada 60s, sem ação do usuário.
  useEffect(() => {
    sync.mutate();
    const id = setInterval(() => sync.mutate(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const todas = metas ?? [];
  const financeiras = todas.filter((m) => (m.tipo ?? "financeira") === "financeira");
  const pessoais = todas.filter((m) => m.tipo === "pessoal");
  // Metas de projeto foram descontinuadas: prazos moram dentro do projeto.
  const allMetas = [...financeiras, ...pessoais];

  const calcStats = (items: MetaRow[]) => {
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

  const chartData = [
    { name: "Financeiras", total: finStats.total, concluidas: finStats.completed, progresso: finStats.avgProgress },
    { name: "Pessoais", total: pesStats.total, concluidas: pesStats.completed, progresso: pesStats.avgProgress },
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

  const startEdit = (meta: MetaRow) => {
    setEditingMeta(meta);
    setIsEditOpen(true);
  };
  const startDelete = (id: string) => {
    setMetaToDelete(id);
    setDeleteOpen(true);
  };
  const editTipo: MetaTipo = editingMeta?.tipo === "pessoal" ? "pessoal" : "financeira";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Metas com sincronização automática são atualizadas pelas suas fontes (receita, projetos, margem).
      </p>

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
                const tipoLabel = meta.tipo === "pessoal" ? "Pessoal" : "Financeira";
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

      {/* Colunas por tipo: resumo no topo + cards das metas dentro */}
      <div className="grid md:grid-cols-2 gap-4 items-start">
        {[
          {
            label: "Financeiras",
            icon: TrendingUp,
            stats: finStats,
            items: financeiras,
            isPessoal: false,
            color: "text-positive-strong",
            bg: "bg-positive/10",
          },
          {
            label: "Pessoais",
            icon: Users,
            stats: pesStats,
            items: pessoais,
            isPessoal: true,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="">
              <CardContent className="p-4 space-y-4">
                {/* Resumo do tipo */}
                <div>
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
                </div>

                {/* Cards das metas do tipo */}
                <div className="space-y-3 border-t pt-4">
                  {item.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Nenhuma meta cadastrada. Use "Nova meta" no topo para começar.
                    </p>
                  ) : (
                    item.items.map((meta) => (
                      <MetaCard
                        key={meta.id}
                        meta={meta}
                        subtitle={item.isPessoal && meta.pessoa_id ? pessoaMap.get(meta.pessoa_id) : null}
                        onEdit={() => startEdit(meta)}
                        onDelete={() => startDelete(meta.id)}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <MetaFormDialog open={isEditOpen} onOpenChange={setIsEditOpen} tipo={editTipo} meta={editingMeta} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Esta meta será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => metaToDelete && deleteMutation.mutate(metaToDelete)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
