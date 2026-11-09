import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KPICard } from "@/components/KPICard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import type { StatusTone } from "@/lib/status";
import { Target, Building2, User, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchPessoasLookup } from "@/lib/supabaseQueries";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMetasProgresso, METAS_PROGRESSO_KEY } from "@/hooks/useMetas";
import { MetaCard } from "../components/MetaCard";
import { MetaFormDialog } from "../components/MetaFormDialog";
import { STATUS_LABEL, montarMetaView, type MetaRow, type MetaStatus, type MetaView } from "@/lib/metas";

import { ReadingRing } from "@/components/motion/ReadingRing";

const TODAS = "todas";
const EMPRESA = "empresa";

interface Grupo {
  key: string;
  label: string;
  items: MetaView[];
}

const calcStats = (items: MetaView[]) => {
  // Meta restrita (sem acesso ao valor) conta no total, mas não entra na média.
  const medidas = items.filter((v) => !v.restrito);
  const avgProgress = medidas.length ? Math.round(medidas.reduce((acc, v) => acc + v.percent, 0) / medidas.length) : 0;
  return {
    total: items.length,
    completed: items.filter((v) => v.status === "concluida").length,
    overdue: items.filter((v) => v.status === "atrasada").length,
    avgProgress,
  };
};

interface MetasDashboardProps {
  onCreate: () => void;
}

export default function MetasDashboard({ onCreate }: MetasDashboardProps) {
  const queryClient = useQueryClient();

  const [editingMeta, setEditingMeta] = useState<MetaRow | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<MetaRow | null>(null);
  const [escopoFiltro, setEscopoFiltro] = useState<string>(TODAS);
  const [statusFiltro, setStatusFiltro] = useState<string>(TODAS);

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MetaRow[];
    },
  });

  const { data: pessoas } = useQuery({
    queryKey: ["pessoas-list"],
    queryFn: fetchPessoasLookup,
  });

  // O valor de meta com indicador vem do banco, calculado para o período corrente.
  const { data: progresso, isError: progressoComErro } = useMetasProgresso();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-all"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      queryClient.invalidateQueries({ queryKey: METAS_PROGRESSO_KEY });
      setMetaToDelete(null);
      toast.success("Meta excluída");
    },
    onError: () => {
      toast.error("Não foi possível excluir a meta", { description: "Tente novamente em instantes." });
    },
  });

  const pessoaNome = useMemo(() => new Map((pessoas ?? []).map((p) => [p.id, p.nome])), [pessoas]);

  const views = useMemo(() => {
    const hoje = new Date();
    return (metas ?? []).map((m) => montarMetaView(m, progresso?.get(m.id), hoje));
  }, [metas, progresso]);

  const labelDoEscopo = (pessoaId: string | null): string =>
    pessoaId ? (pessoaNome.get(pessoaId) ?? "Pessoa removida") : "Empresa";

  // Escopos que têm meta: alimentam o filtro.
  const escoposComMeta = useMemo(() => {
    const ids = new Set(views.map((v) => v.meta.pessoa_id ?? EMPRESA));
    return [...ids]
      .map((id) => ({ id, label: id === EMPRESA ? "Empresa" : (pessoaNome.get(id) ?? "Pessoa removida") }))
      .sort((a, b) => (a.id === EMPRESA ? -1 : b.id === EMPRESA ? 1 : a.label.localeCompare(b.label, "pt-BR")));
  }, [views, pessoaNome]);

  const filtradas = useMemo(
    () =>
      views.filter(
        (v) =>
          (escopoFiltro === TODAS || (v.meta.pessoa_id ?? EMPRESA) === escopoFiltro) &&
          (statusFiltro === TODAS || v.status === statusFiltro)
      ),
    [views, escopoFiltro, statusFiltro]
  );

  const grupos = useMemo<Grupo[]>(() => {
    const porEscopo = new Map<string, MetaView[]>();
    for (const v of filtradas) {
      const key = v.meta.pessoa_id ?? EMPRESA;
      porEscopo.set(key, [...(porEscopo.get(key) ?? []), v]);
    }
    return [...porEscopo.entries()]
      .map(([key, items]) => ({
        key,
        label: key === EMPRESA ? "Empresa" : (pessoaNome.get(key) ?? "Pessoa removida"),
        items,
      }))
      .sort((a, b) => (a.key === EMPRESA ? -1 : b.key === EMPRESA ? 1 : a.label.localeCompare(b.label, "pt-BR")));
  }, [filtradas, pessoaNome]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ReadingRing size={64} />
      </div>
    );
  }

  if (views.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Nenhuma meta cadastrada"
        description="Crie a primeira meta: escolha o que medir, para quem e em que período."
        action={{ label: "Nova meta", onClick: onCreate, variant: "brand" }}
      />
    );
  }

  const stats = calcStats(filtradas);

  const summaryCards: { label: string; value: string; icon: typeof Target; tone: StatusTone }[] = [
    { label: "Total de metas", value: stats.total.toString(), icon: Target, tone: "neutral" },
    { label: "Concluídas", value: stats.completed.toString(), icon: CheckCircle2, tone: "positive" },
    { label: "Progresso médio", value: `${stats.avgProgress}%`, icon: Clock, tone: "neutral" },
    { label: "Atrasadas", value: stats.overdue.toString(), icon: AlertTriangle, tone: "danger" },
  ];

  const chartData = grupos.map((g) => {
    const s = calcStats(g.items);
    return { name: g.label.split(" ")[0], total: s.total, concluidas: s.completed };
  });

  const topMetas = filtradas
    .filter((v) => !v.restrito)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  const startEdit = (meta: MetaRow) => {
    setEditingMeta(meta);
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Metas com indicador se atualizam sozinhas. As manuais você atualiza ao editar.
        {progressoComErro && " Não foi possível calcular o progresso agora: mostrando o último valor salvo."}
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 w-full sm:w-56">
          <Label className="text-xs">Para quem</Label>
          <Select value={escopoFiltro} onValueChange={setEscopoFiltro}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todos</SelectItem>
              {escoposComMeta.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 w-full sm:w-48">
          <Label className="text-xs">Situação</Label>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {(Object.keys(STATUS_LABEL) as MetaStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <KPICard key={card.label} icon={card.icon} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </div>

      {filtradas.length === 0 ? (
        <EmptyState compact title="Nenhuma meta com esses filtros." />
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metas por pessoa</CardTitle>
                <CardDescription>Quantas metas cada escopo tem e quantas já foram batidas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Metas" fill="hsl(var(--brand-accent))" radius={[4, 4, 0, 0]} />
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 metas</CardTitle>
                <CardDescription>Metas com maior progresso no período atual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topMetas.length === 0 ? (
                  <EmptyState compact title="Sem metas com valor visível." />
                ) : (
                  topMetas.map((v) => (
                    <div key={v.meta.id} className="space-y-1.5">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{v.meta.nome}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-ink-muted shrink-0">
                            {labelDoEscopo(v.meta.pessoa_id)}
                          </span>
                        </div>
                        <span className="text-sm font-bold">{v.percent}%</span>
                      </div>
                      <Progress
                        value={v.percent}
                        className="h-2 bg-muted"
                        indicatorClassName={v.percent >= 100 ? "bg-positive" : "bg-brand"}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {grupos.map((grupo) => {
            const s = calcStats(grupo.items);
            const Icon = grupo.key === EMPRESA ? Building2 : User;
            return (
              <section key={grupo.key} className="space-y-3" aria-label={`Metas: ${grupo.label}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{grupo.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {s.total} {s.total === 1 ? "meta" : "metas"} · {s.completed}{" "}
                      {s.completed === 1 ? "concluída" : "concluídas"} · {s.avgProgress}% de progresso
                    </p>
                  </div>
                  <Progress
                    value={s.avgProgress}
                    className="h-2 w-32 hidden sm:block bg-muted"
                    indicatorClassName={s.avgProgress >= 100 ? "bg-positive" : "bg-brand"}
                  />
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                  {grupo.items.map((v) => (
                    <MetaCard
                      key={v.meta.id}
                      view={v}
                      onEdit={() => startEdit(v.meta)}
                      onDelete={() => setMetaToDelete(v.meta)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      <MetaFormDialog open={isEditOpen} onOpenChange={setIsEditOpen} meta={editingMeta} />

      <ConfirmDialog
        open={!!metaToDelete}
        onOpenChange={(o) => !o && setMetaToDelete(null)}
        onConfirm={() => metaToDelete && deleteMutation.mutate(metaToDelete.id)}
        title="Excluir meta?"
        itemName={metaToDelete?.nome}
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
