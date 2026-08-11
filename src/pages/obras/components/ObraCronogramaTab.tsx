import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Layers, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { calcularAvanco, estadoFrenteCronograma, type EstadoFrente } from "@/lib/obras";
import {
  addDays,
  barPosition,
  endOfMonth,
  generateColumns,
  parseDate,
  startOfMonth,
  todayPosition,
  type ZoomLevel,
} from "@/lib/cronograma";
import { useObraFrentes, useCreateFrente, type ObraFrenteRow } from "@/hooks/useObraFrentes";
import { useObraTarefas } from "@/hooks/useObraTarefas";
import { FrenteDetailDialog } from "./FrenteDetailDialog";

const ESTADO_BAR: Record<EstadoFrente, string> = {
  concluida: "bg-positive/100",
  atrasada: "bg-red-500",
  em_andamento: "bg-blue-500",
  futura: "bg-gray-400",
  sem_prazo: "bg-gray-300",
};

const ESTADO_LABEL: Record<EstadoFrente, string> = {
  concluida: "Concluída",
  atrasada: "Atrasada",
  em_andamento: "Em andamento",
  futura: "A iniciar",
  sem_prazo: "Sem prazo",
};

const LEGENDA: EstadoFrente[] = ["em_andamento", "concluida", "atrasada", "futura"];

export function ObraCronogramaTab({
  obraId,
  projetoId,
  canEdit,
}: {
  obraId: string;
  projetoId: string | null;
  canEdit: boolean;
}) {
  const { data: frentes = [], isLoading } = useObraFrentes(obraId);
  const { data: tarefas = [] } = useObraTarefas(obraId);
  const createFrente = useCreateFrente(obraId);

  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const [selecionada, setSelecionada] = useState<ObraFrenteRow | null | undefined>(undefined);
  const [novaFrente, setNovaFrente] = useState("");
  const [novoInicio, setNovoInicio] = useState("");
  const [novoFim, setNovoFim] = useState("");

  const tarefasDe = (frenteId: string | null) => tarefas.filter((t) => (t.obra_frente_id ?? null) === frenteId);
  const comDatas = frentes.filter((f) => f.data_inicio && f.data_fim);
  const semPrazo = frentes.filter((f) => !f.data_inicio || !f.data_fim);
  const semFrente = tarefasDe(null);

  const { columns, rows, todayPct, colWidth } = useMemo(() => {
    if (comDatas.length === 0) {
      return { columns: [], rows: [], todayPct: -1, colWidth: 120 };
    }
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const f of comDatas) {
      const start = parseDate(f.data_inicio);
      const end = parseDate(f.data_fim);
      if (start && (!minDate || start < minDate)) minDate = start;
      if (end && (!maxDate || end > maxDate)) maxDate = end;
    }
    const tlStart = startOfMonth(minDate || new Date());
    const tlEnd = endOfMonth(addDays(maxDate || addDays(tlStart, 90), 14));
    const cols = generateColumns(tlStart, tlEnd, zoom);

    const rowData = comDatas.map((f) => {
      const start = parseDate(f.data_inicio)!;
      const end = parseDate(f.data_fim)!;
      const daFrente = tarefasDe(f.id);
      const estado = estadoFrenteCronograma(f, daFrente);
      const { leftPct, widthPct } = barPosition(start, end, tlStart, tlEnd);
      return { frente: f, estado, progresso: calcularAvanco(daFrente), total: daFrente.length, leftPct, widthPct };
    });

    return {
      columns: cols,
      rows: rowData,
      todayPct: todayPosition(tlStart, tlEnd),
      colWidth: zoom === "weeks" ? 80 : 120,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comDatas, tarefas, zoom]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  const addFrente = async () => {
    if (!novaFrente.trim()) return;
    if (novoInicio && novoFim && novoFim < novoInicio) {
      toast.error("A data de fim não pode ser antes do início");
      return;
    }
    try {
      await createFrente.mutateAsync({
        nome: novaFrente.trim(),
        ordem: frentes.length,
        data_inicio: novoInicio || null,
        data_fim: novoFim || null,
      });
      setNovaFrente("");
      setNovoInicio("");
      setNovoFim("");
    } catch (e) {
      toast.error("Não foi possível criar a frente", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  const vazio = frentes.length === 0 && semFrente.length === 0;

  return (
    <div className="space-y-4">
      {vazio ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma frente ainda"
          description="Organize a obra por frente de serviço (fundação, alvenaria, instalações), defina o período de cada uma e acompanhe o prazo na linha do tempo."
        />
      ) : (
        <>
          {comDatas.length > 0 && (
            <Card>
              <CardContent className="p-0">
                {/* Cabeçalho: título + zoom */}
                <div className="flex items-center justify-between gap-3 border-b p-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-ink">Linha do tempo</h3>
                    <span className="text-[11px] text-muted-foreground">
                      {comDatas.length} frente{comDatas.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex items-center overflow-hidden rounded-md border">
                    <Button
                      variant={zoom === "months" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 rounded-none px-2 text-xs"
                      onClick={() => setZoom("months")}
                    >
                      <ZoomOut className="mr-1 h-3 w-3" /> Meses
                    </Button>
                    <Button
                      variant={zoom === "weeks" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 rounded-none px-2 text-xs"
                      onClick={() => setZoom("weeks")}
                    >
                      <ZoomIn className="mr-1 h-3 w-3" /> Semanas
                    </Button>
                  </div>
                </div>

                {/* Gantt */}
                <div className="flex">
                  {/* Coluna fixa: frentes */}
                  <div className="w-[220px] flex-shrink-0 border-r bg-muted/30">
                    <div className="flex h-10 items-center border-b px-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Frente
                      </span>
                    </div>
                    {rows.map((row) => (
                      <button
                        key={row.frente.id}
                        onClick={() => setSelecionada(row.frente)}
                        className="flex h-14 w-full flex-col justify-center border-b px-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="truncate text-xs font-medium text-ink">{row.frente.nome}</span>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={cn("inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full", ESTADO_BAR[row.estado])} aria-hidden />
                          <span className="truncate text-[10px] text-muted-foreground">
                            {ESTADO_LABEL[row.estado]}
                            {row.total > 0 && ` · ${row.progresso}%`}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Timeline scrollável */}
                  <div className="flex-1 overflow-x-auto">
                    <div className="relative" style={{ minWidth: `${columns.length * colWidth}px` }}>
                      {/* Cabeçalho de colunas */}
                      <div className="relative flex h-10 border-b">
                        {columns.map((col, i) => (
                          <div key={i} className="flex flex-1 items-center justify-center border-r last:border-r-0">
                            <span className="text-[10px] font-medium capitalize text-muted-foreground">{col.label}</span>
                          </div>
                        ))}
                        {todayPct >= 0 && (
                          <div className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-red-500" style={{ left: `${todayPct}%` }}>
                            <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-t-sm bg-red-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
                              HOJE
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Linhas */}
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
                          {columns.map((_, i) => (
                            <div key={i} className="flex-1 border-r border-dashed border-gray-100 last:border-r-0" />
                          ))}
                        </div>
                        {todayPct >= 0 && (
                          <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-red-500" style={{ left: `${todayPct}%` }} />
                        )}

                        {rows.map((row) => (
                          <div key={row.frente.id} className="relative h-14 border-b">
                            <button
                              onClick={() => setSelecionada(row.frente)}
                              title={`${row.frente.data_inicio} → ${row.frente.data_fim}`}
                              className={cn(
                                "absolute top-3 flex h-8 items-center rounded-md border border-black/5 px-2.5 shadow-sm transition-shadow hover:shadow-md",
                                ESTADO_BAR[row.estado],
                              )}
                              style={{ left: `${row.leftPct}%`, width: `${row.widthPct}%`, minWidth: "40px" }}
                            >
                              <span className="truncate text-[10px] font-medium text-white">
                                {row.total > 0 ? `${row.progresso}%` : row.frente.nome}
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legenda */}
          {comDatas.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              {LEGENDA.map((estado) => (
                <div key={estado} className="flex items-center gap-1.5">
                  <div className={cn("h-2.5 w-6 rounded-sm", ESTADO_BAR[estado])} />
                  <span>{ESTADO_LABEL[estado]}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-0.5 bg-red-500" />
                <span>Hoje</span>
              </div>
            </div>
          )}

          {/* Frentes sem prazo definido */}
          {semPrazo.length > 0 && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {semPrazo.length} frente{semPrazo.length > 1 ? "s" : ""} sem prazo definido (fora da linha do tempo)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {semPrazo.map((f) => (
                    <Button key={f.id} variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelecionada(f)}>
                      <Layers className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      {f.nome}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pendências sem frente */}
          {semFrente.length > 0 && (
            <button
              onClick={() => setSelecionada(null)}
              className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white p-4 text-left transition-colors hover:bg-muted/30"
            >
              <span className="text-sm font-medium text-ink">Pendências sem frente</span>
              <span className="text-xs text-muted-foreground">
                {semFrente.filter((t) => t.status !== "concluida").length} aberta
                {semFrente.filter((t) => t.status !== "concluida").length === 1 ? "" : "s"}
              </span>
            </button>
          )}
        </>
      )}

      {/* Criar frente */}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-black/10 p-3">
          <div className="flex-1">
            <Input
              value={novaFrente}
              onChange={(e) => setNovaFrente(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFrente()}
              placeholder="Nova frente de serviço…"
              className="h-9 min-w-[12rem]"
            />
          </div>
          <Input
            type="date"
            value={novoInicio}
            onChange={(e) => setNovoInicio(e.target.value)}
            className="h-9 w-36"
            aria-label="Início"
          />
          <Input
            type="date"
            value={novoFim}
            onChange={(e) => setNovoFim(e.target.value)}
            className="h-9 w-36"
            aria-label="Fim"
          />
          <Button variant="outline" size="sm" onClick={addFrente} disabled={!novaFrente.trim() || createFrente.isPending}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar frente
          </Button>
        </div>
      )}

      <FrenteDetailDialog
        open={selecionada !== undefined}
        onOpenChange={(v) => !v && setSelecionada(undefined)}
        obraId={obraId}
        projetoId={projetoId}
        frente={selecionada ?? null}
        canEdit={canEdit}
      />
    </div>
  );
}
