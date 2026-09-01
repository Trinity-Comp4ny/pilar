import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ClipboardList, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { climaLabel } from "@/lib/obras";
import { useObraFrentes } from "@/hooks/useObraFrentes";
import { useObraTarefas } from "@/hooks/useObraTarefas";
import { useObraRdos } from "@/hooks/useObraRdo";
import type { ObraResumo } from "@/hooks/useObras";
import { ObraCurvaS } from "./ObraCurvaS";

/** Marcos de faturamento do projeto (somente leitura no MVP — spec 015). */
function useMarcosProjeto(projetoId: string | null) {
  return useQuery({
    queryKey: ["obra_marcos", projetoId],
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marcos_faturamento")
        .select("id, nome, valor, data_prevista, status")
        .eq("projeto_id", projetoId!)
        .order("data_prevista", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-medium text-ink">{titulo}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export function ObraTimelineTab({ obra, onIrParaDiario }: { obra: ObraResumo; onIrParaDiario: () => void }) {
  const formatCurrency = useMoneyMask();
  const { data: frentes = [] } = useObraFrentes(obra.id);
  const { data: tarefas = [] } = useObraTarefas(obra.id);
  const { data: rdos = [] } = useObraRdos(obra.id);
  const { data: marcos = [] } = useMarcosProjeto(obra.projeto_id);

  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  const rdosRecentes = rdos.slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Bloco titulo="Avanço">
        <div className="mb-1 flex items-end justify-between">
          <span className="text-2xl font-semibold tabular-nums text-ink">{obra.avanco}%</span>
          <span className="text-xs text-muted-foreground">
            {concluidas} de {total} tarefas concluídas
          </span>
        </div>
        <Progress value={obra.avanco} className="h-2" />
      </Bloco>

      <div className="lg:col-span-2">
        <Bloco titulo="Curva S — planejado × realizado">
          <ObraCurvaS obraId={obra.id} />
        </Bloco>
      </div>

      <Bloco titulo="Etapas">
        {frentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma etapa ainda. Abra a aba Cronograma para organizar as etapas.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {frentes.map((f) => {
              const daFrente = tarefas.filter((t) => t.obra_frente_id === f.id);
              const abertas = daFrente.filter((t) => t.status !== "concluida").length;
              return (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{f.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {abertas === 0 ? "sem pendências" : `${abertas} pendente${abertas > 1 ? "s" : ""}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Diário recente">
        {rdosRecentes.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
            <Button variant="outline" size="sm" onClick={onIrParaDiario}>
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Registrar dia
            </Button>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rdosRecentes.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(r.data)}
                </span>
                <span className="text-xs text-muted-foreground">{climaLabel(r.clima) || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo={obra.projeto_id ? "Marcos de faturamento" : "Projeto"}>
        {!obra.projeto_id ? (
          <p className="text-sm text-muted-foreground">
            Esta obra não está ligada a um projeto. Vincule na edição para ver marcos e faturamento.
          </p>
        ) : marcos.length === 0 ? (
          <p className="text-sm text-muted-foreground">O projeto não tem marcos cadastrados.</p>
        ) : (
          <>
            {/* Contexto pra decidir se já é hora de faturar (spec 065) — avanço
                da OBRA inteira, não do marco específico: a UI não pode implicar
                uma precisão por marco que o dado não sustenta. */}
            <p className="-mt-1 text-xs text-muted-foreground">Obra {obra.avanco}% concluída</p>
            <ul className="space-y-1.5">
              {marcos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-ink">{m.nome}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {m.data_prevista ? formatDate(m.data_prevista) : "sem data"} · {formatCurrency(m.valor)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Bloco>
    </div>
  );
}
