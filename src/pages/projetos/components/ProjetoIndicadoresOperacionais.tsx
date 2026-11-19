import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock, ListTodo, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatHoras, formatPercent } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { TarefaItem } from "@/hooks/tarefas/useTarefas";
import type { ProjetoDisciplinaDB } from "@/types/projetos";

export interface IndicadoresProjetoProps {
  projetoId: string;
  hoje: string;
  tarefas?: TarefaItem[];
  atrasadas?: number;
  internas: number;
  cliente?: number;
  disciplinas: ProjetoDisciplinaDB[];
  financeiro?: { margem: number | null; meta: number | null };
  abrir: (destino: "cronograma" | "tarefas" | "atrasadas" | "revisoes" | "disciplinas" | "pagamentos") => void;
}

export function ProjetoIndicadoresOperacionais({
  projetoId,
  hoje,
  tarefas,
  atrasadas,
  internas,
  cliente,
  disciplinas,
  financeiro,
  abrir,
}: IndicadoresProjetoProps) {
  const { data: marcos } = useQuery({
    queryKey: ["projeto-proximo-marco", projetoId, hoje],
    enabled: !!financeiro,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marcos_faturamento")
        .select("id, nome, disciplina, data_prevista")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .eq("status", "pendente")
        .gte("data_prevista", hoje)
        .order("data_prevista")
        .order("id")
        .limit(1);
      if (error) throw error;
      return data;
    },
  });
  const marco = marcos?.[0];
  const tarefa = tarefas
    ?.filter((t) => t.status !== "concluida" && t.prazo && t.prazo >= hoje)
    .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? "") || a.id.localeCompare(b.id))[0];
  const prazo = marco?.data_prevista ?? tarefa?.prazo;
  const responsaveis = marco
    ? disciplinas.find((d) => d.nome === marco.disciplina)?.responsaveis
    : tarefa?.responsaveis;
  const previstas = disciplinas.reduce((total, d) => total + (d.horas_estimadas ?? 0), 0);
  const realizadas = disciplinas.reduce((total, d) => total + (d.horas_realizadas ?? 0), 0);
  const apontadas = tarefas?.reduce((total, t) => total + (t.horas_reais ?? 0), 0) ?? 0;
  const retrabalho = tarefas?.reduce((total, t) => total + (t.retrabalho ? (t.horas_reais ?? 0) : 0), 0) ?? 0;

  return (
    <section aria-label="Indicadores operacionais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4" />
            {marco ? "Próximo marco" : tarefa ? "Próxima tarefa" : "Próximo prazo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm font-semibold">{marco?.nome ?? tarefa?.titulo ?? "Sem marco ou tarefa com prazo"}</p>
          {prazo && (
            <p className="text-xs text-muted-foreground">
              {formatDate(prazo)} · {responsaveis?.map((p) => p.nome).join(", ") || "Sem responsável"}
            </p>
          )}
          <Button size="sm" variant="link" className="h-auto px-0" onClick={() => abrir("cronograma")}>
            Ver cronograma
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListTodo className="size-4" />
            Pendências
          </CardTitle>
        </CardHeader>
        <CardContent className="grid justify-items-start gap-1">
          <Button size="sm" variant="link" className="h-auto px-0" onClick={() => abrir("atrasadas")}>
            Tarefas em atraso · {atrasadas ?? "—"}
          </Button>
          <Button size="sm" variant="link" className="h-auto px-0" onClick={() => abrir("revisoes")}>
            Revisões internas · {internas} abertas
          </Button>
          {cliente !== undefined && (
            <Button size="sm" variant="link" className="h-auto px-0" onClick={() => abrir("revisoes")}>
              Aguardando cliente · {cliente}
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="size-4" />
            Horas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid justify-items-start gap-1">
          <Button size="sm" variant="link" className="h-auto px-0" onClick={() => abrir("disciplinas")}>
            Horas das disciplinas · {formatHoras(realizadas) ?? "0h"} / {formatHoras(previstas) ?? "0h"}
          </Button>
          <p className="text-xs text-muted-foreground">Realizadas / previstas</p>
          {apontadas > 0 ? (
            <Button size="sm" variant="link" className="h-auto px-0" onClick={() => abrir("tarefas")}>
              Retrabalho nas tarefas · {formatPercent((100 * retrabalho) / apontadas)}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Retrabalho · {tarefas ? "Sem horas de tarefas apontadas" : "Horas de tarefas indisponíveis"}
            </p>
          )}
        </CardContent>
      </Card>
      {financeiro && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4" />
              Margem bruta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold tabular-nums">
              {financeiro.margem === null ? "—" : formatPercent(financeiro.margem)}
            </p>
            {financeiro.meta !== null && (
              <p className="text-xs text-muted-foreground">
                Meta líquida da proposta · {formatPercent(financeiro.meta)}
              </p>
            )}
            <Button size="sm" variant="link" className="h-auto px-0" onClick={() => abrir("pagamentos")}>
              Ver pagamentos
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
