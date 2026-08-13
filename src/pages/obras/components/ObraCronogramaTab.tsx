import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Layers,
  Plus,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import {
  calcularAvanco,
  estadoFrenteCronograma,
  estadoTarefaCronograma,
  spanFrente,
  type EstadoFrente,
  type EstadoTarefa,
} from "@/lib/obras";
import {
  addDays,
  barPosition,
  diffDays,
  endOfMonth,
  generateColumns,
  parseDate,
  snapToBoundary,
  startOfMonth,
  toIso,
  todayPosition,
  type ZoomLevel,
} from "@/lib/cronograma";
import { useObraFrentes, useCreateFrente, useUpdateFrente, type ObraFrenteRow } from "@/hooks/useObraFrentes";
import { useObraTarefas, useCreateObraTarefa, useUpdateObraTarefa, type ObraTarefa } from "@/hooks/useObraTarefas";
import { FrenteDetailDialog } from "./FrenteDetailDialog";

const ESTADO_BAR: Record<EstadoFrente, string> = {
  concluida: "bg-positive/100",
  atrasada: "bg-red-500",
  em_andamento: "bg-status-progress",
  futura: "bg-gray-400",
  sem_prazo: "bg-status-unknown",
};

const ESTADO_LABEL: Record<EstadoFrente, string> = {
  concluida: "Concluída",
  atrasada: "Atrasada",
  em_andamento: "Em andamento",
  futura: "A iniciar",
  sem_prazo: "Sem prazo",
};

const ESTADO_TAREFA_BAR: Record<EstadoTarefa, string> = {
  concluida: "bg-positive/100",
  atrasada: "bg-red-500",
  em_andamento: "bg-status-progress",
  futura: "bg-gray-400",
  sem_periodo: "bg-status-unknown",
};

const ESTADO_TAREFA_LABEL: Record<EstadoTarefa, string> = {
  concluida: "Concluída",
  atrasada: "Atrasada",
  em_andamento: "Em andamento",
  futura: "A iniciar",
  sem_periodo: "Sem período",
};

const LEGENDA: EstadoFrente[] = ["em_andamento", "concluida", "atrasada", "futura"];

const ROW_H = 56; // linha da etapa
const SUB_H = 36; // linha da tarefa e do "+ tarefa"

type DragKind = "frente" | "tarefa";
type DragType = "left" | "right" | "move";

interface DragState {
  kind: DragKind;
  id: string;
  type: DragType;
  startX: number;
  origStart: Date;
  origEnd: Date;
}

interface DragOverride {
  kind: DragKind;
  id: string;
  type: DragType;
  start: Date;
  end: Date;
}

type TarefaRow = {
  tarefa: ObraTarefa;
  estado: EstadoTarefa;
  bar: { start: Date; end: Date } | null;
};

type FrenteRow = {
  frente: ObraFrenteRow;
  estado: EstadoFrente;
  progresso: number;
  total: number;
  bar: { start: Date; end: Date } | null; // datas próprias da etapa
  tarefas: TarefaRow[];
};

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
  const updateFrente = useUpdateFrente(obraId);
  const createTarefa = useCreateObraTarefa(obraId, projetoId);
  const updateTarefa = useUpdateObraTarefa(obraId);

  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const [selecionada, setSelecionada] = useState<ObraFrenteRow | null | undefined>(undefined);
  // Etapas recolhidas (por id). Vazio = todas expandidas por padrão.
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  // Etapa com o campo "nova tarefa" aberto inline.
  const [addTarefaFrenteId, setAddTarefaFrenteId] = useState<string | null>(null);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [novaEtapa, setNovaEtapa] = useState("");
  const [novoInicio, setNovoInicio] = useState("");
  const [novoFim, setNovoFim] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Vira true quando o arraste move de fato, para suprimir o clique que o
  // navegador dispara no fim do drag (senão abriria o dialog sem querer).
  const dragMovedRef = useRef(false);
  const zoomRef = useRef<ZoomLevel>(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const tarefasDe = (frenteId: string | null) => tarefas.filter((t) => (t.obra_frente_id ?? null) === frenteId);
  const semFrente = tarefasDe(null);

  const toggleFrente = (id: string) =>
    setRecolhidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { columns, frenteRows, semPrazo, tlStart, tlEnd, todayPct, colWidth } = useMemo(() => {
    const spans = frentes.map((f) => ({ frente: f, span: spanFrente(f, tarefasDe(f.id)) }));
    const comDatas = spans.filter((s) => s.span !== null);
    const semPrazoList = spans.filter((s) => s.span === null).map((s) => s.frente);

    if (comDatas.length === 0) {
      const now = new Date();
      return {
        columns: [],
        frenteRows: [] as FrenteRow[],
        semPrazo: semPrazoList,
        tlStart: now,
        tlEnd: now,
        todayPct: -1,
        colWidth: 120,
      };
    }

    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const { span } of comDatas) {
      const start = parseDate(span!.inicio);
      const end = parseDate(span!.fim);
      if (start && (!minDate || start < minDate)) minDate = start;
      if (end && (!maxDate || end > maxDate)) maxDate = end;
    }
    const start = startOfMonth(minDate || new Date());
    const end = endOfMonth(addDays(maxDate || addDays(start, 90), 14));
    const cols = generateColumns(start, end, zoom);

    const rows: FrenteRow[] = comDatas.map(({ frente }) => {
      const daFrente = tarefasDe(frente.id);
      const fInicio = parseDate(frente.data_inicio);
      const fFim = parseDate(frente.data_fim);
      return {
        frente,
        estado: estadoFrenteCronograma(frente, daFrente),
        progresso: calcularAvanco(daFrente),
        total: daFrente.length,
        bar: fInicio && fFim ? { start: fInicio, end: fFim } : null,
        tarefas: daFrente.map((t) => {
          const ini = parseDate(t.data_inicio);
          const fim = parseDate(t.prazo);
          return {
            tarefa: t,
            estado: estadoTarefaCronograma(t),
            bar: ini && fim ? { start: ini, end: fim } : null,
          };
        }),
      };
    });

    return {
      columns: cols,
      frenteRows: rows,
      semPrazo: semPrazoList,
      tlStart: start,
      tlEnd: end,
      todayPct: todayPosition(start, end),
      colWidth: zoom === "weeks" ? 80 : 120,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frentes, tarefas, zoom]);

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current || todayPct < 0) return;
    const c = scrollRef.current;
    c.scrollTo({ left: (todayPct / 100) * c.scrollWidth - c.clientWidth / 2, behavior: "smooth" });
  }, [todayPct]);

  useEffect(() => {
    if (todayPct >= 0) scrollToToday();
  }, [todayPct, scrollToToday]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const pxPerDay = useCallback((): number => {
    if (!timelineRef.current) return 1;
    const total = diffDays(tlStart, tlEnd);
    return total > 0 ? timelineRef.current.offsetWidth / total : 1;
  }, [tlStart, tlEnd]);

  const startDrag = useCallback(
    (e: React.MouseEvent, kind: DragKind, id: string, type: DragType, base: { start: Date; end: Date }) => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      dragMovedRef.current = false;
      dragRef.current = {
        kind,
        id,
        type,
        startX: e.clientX,
        origStart: new Date(base.start),
        origEnd: new Date(base.end),
      };
    },
    [canEdit]
  );

  useEffect(() => {
    const reset = () => {
      dragRef.current = null;
      setDragOverride(null);
    };

    const apply = (clientX: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaDays = Math.round((clientX - drag.startX) / pxPerDay());
      if (deltaDays !== 0) dragMovedRef.current = true;
      let newStart = new Date(drag.origStart);
      let newEnd = new Date(drag.origEnd);
      if (drag.type === "left") {
        newStart = addDays(drag.origStart, deltaDays);
        if (newStart >= newEnd) newStart = addDays(newEnd, -1);
        newStart = snapToBoundary(newStart, zoomRef.current);
      } else if (drag.type === "right") {
        newEnd = addDays(drag.origEnd, deltaDays);
        if (newEnd <= newStart) newEnd = addDays(newStart, 1);
        newEnd = snapToBoundary(newEnd, zoomRef.current);
      } else {
        newStart = addDays(drag.origStart, deltaDays);
        newEnd = addDays(drag.origEnd, deltaDays);
      }
      setDragOverride({ kind: drag.kind, id: drag.id, type: drag.type, start: newStart, end: newEnd });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current) apply(e.clientX);
    };

    const commit = async () => {
      const drag = dragRef.current;
      const override = dragOverride;
      reset();
      if (!drag || !override) return;
      if (toIso(override.start) === toIso(drag.origStart) && toIso(override.end) === toIso(drag.origEnd)) return;
      setIsSaving(true);
      try {
        if (drag.kind === "frente") {
          await updateFrente.mutateAsync({
            id: drag.id,
            data_inicio: toIso(override.start),
            data_fim: toIso(override.end),
          });
        } else {
          await updateTarefa.mutateAsync({
            id: drag.id,
            data_inicio: toIso(override.start),
            prazo: toIso(override.end),
          });
        }
      } catch (err) {
        toast.error("Não foi possível salvar a data", {
          description: err instanceof Error ? err.message : "Tente novamente",
        });
      } finally {
        setIsSaving(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current) reset();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", commit);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", commit);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dragOverride, pxPerDay, updateFrente, updateTarefa]);

  const geom = (kind: DragKind, id: string, base: { start: Date; end: Date }) => {
    const ov = dragOverride && dragOverride.kind === kind && dragOverride.id === id ? dragOverride : null;
    const start = ov ? ov.start : base.start;
    const end = ov ? ov.end : base.end;
    return { ...barPosition(start, end, tlStart, tlEnd), start, end };
  };

  const addEtapa = async () => {
    if (!novaEtapa.trim()) return;
    if (novoInicio && novoFim && novoFim < novoInicio) {
      toast.error("A data de fim não pode ser antes do início");
      return;
    }
    try {
      await createFrente.mutateAsync({
        nome: novaEtapa.trim(),
        ordem: frentes.length,
        data_inicio: novoInicio || null,
        data_fim: novoFim || null,
      });
      setNovaEtapa("");
      setNovoInicio("");
      setNovoFim("");
    } catch (e) {
      toast.error("Não foi possível criar a etapa", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  const addTarefa = async (frente: ObraFrenteRow) => {
    const titulo = novaTarefaTitulo.trim();
    if (!titulo) return;
    try {
      await createTarefa.mutateAsync({
        titulo,
        obra_frente_id: frente.id,
        // Herda o período da etapa: já nasce com barra para o usuário ajustar.
        data_inicio: frente.data_inicio ?? null,
        prazo: frente.data_fim ?? null,
      });
      setNovaTarefaTitulo("");
      // Mantém o campo aberto para adicionar várias em sequência.
      setRecolhidas((prev) => {
        const next = new Set(prev);
        next.delete(frente.id);
        return next;
      });
    } catch (e) {
      toast.error("Não foi possível adicionar a tarefa", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const vazio = frentes.length === 0 && semFrente.length === 0;
  const temTimeline = frenteRows.length > 0;
  const isDragging = dragOverride !== null;

  return (
    <div className="space-y-4" style={{ userSelect: isDragging ? "none" : undefined }}>
      {vazio ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma etapa ainda"
          description="Organize a obra por etapa (fundação, alvenaria, instalações), defina o período de cada uma e das suas tarefas, e acompanhe o prazo na linha do tempo."
        />
      ) : (
        <>
          {temTimeline && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b p-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-ink">Linha do tempo</h3>
                    <span className="text-[11px] text-muted-foreground">
                      {frenteRows.length} etapa{frenteRows.length === 1 ? "" : "s"}
                    </span>
                    {isSaving && <span className="animate-pulse text-[10px] text-muted-foreground">Salvando…</span>}
                    {isDragging && (
                      <span className="rounded border border-dashed border-muted-foreground/30 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                        Esc cancela
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={scrollToToday}
                      disabled={todayPct < 0}
                    >
                      Hoje
                    </Button>
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
                </div>

                <div className="flex">
                  {/* Coluna fixa: etapas + tarefas */}
                  <div className="w-[260px] flex-shrink-0 border-r bg-muted/30">
                    <div className="flex h-10 items-center border-b px-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Etapa / tarefa
                      </span>
                    </div>
                    {frenteRows.map((row) => {
                      const expandida = !recolhidas.has(row.frente.id);
                      return (
                        <div key={row.frente.id}>
                          <div className="flex items-center gap-1 border-b pr-2" style={{ height: ROW_H }}>
                            <button
                              onClick={() => toggleFrente(row.frente.id)}
                              disabled={row.tarefas.length === 0}
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-25"
                              aria-label={expandida ? "Recolher" : "Expandir"}
                            >
                              {expandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => setSelecionada(row.frente)}
                              className="flex min-w-0 flex-1 flex-col justify-center py-1 text-left"
                            >
                              <span className="truncate text-xs font-semibold text-ink">{row.frente.nome}</span>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full",
                                    ESTADO_BAR[row.estado]
                                  )}
                                  aria-hidden
                                />
                                <span className="truncate text-[10px] text-muted-foreground">
                                  {ESTADO_LABEL[row.estado]}
                                  {row.total > 0 &&
                                    ` · ${row.progresso}% · ${row.total} tarefa${row.total === 1 ? "" : "s"}`}
                                </span>
                              </div>
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setAddTarefaFrenteId(row.frente.id);
                                  setNovaTarefaTitulo("");
                                  setRecolhidas((prev) => {
                                    const next = new Set(prev);
                                    next.delete(row.frente.id);
                                    return next;
                                  });
                                }}
                                title="Adicionar tarefa"
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {expandida &&
                            row.tarefas.map((t) => (
                              <button
                                key={t.tarefa.id}
                                onClick={() => setSelecionada(row.frente)}
                                className="flex w-full items-center gap-1.5 border-b bg-white/40 pl-9 pr-3 text-left transition-colors hover:bg-muted/40"
                                style={{ height: SUB_H }}
                              >
                                <span
                                  className={cn(
                                    "inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full",
                                    ESTADO_TAREFA_BAR[t.estado]
                                  )}
                                  aria-hidden
                                />
                                <span
                                  className={cn(
                                    "truncate text-[11px]",
                                    t.tarefa.status === "concluida" ? "text-muted-foreground line-through" : "text-ink"
                                  )}
                                >
                                  {t.tarefa.titulo}
                                </span>
                                {!t.bar && (
                                  <span className="ml-auto flex-shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                                    sem período
                                  </span>
                                )}
                              </button>
                            ))}

                          {expandida && canEdit && (
                            <div className="flex items-center border-b bg-white/40 pl-9 pr-3" style={{ height: SUB_H }}>
                              {addTarefaFrenteId === row.frente.id ? (
                                <div className="flex w-full items-center gap-1">
                                  <Input
                                    autoFocus
                                    value={novaTarefaTitulo}
                                    onChange={(e) => setNovaTarefaTitulo(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") addTarefa(row.frente);
                                      if (e.key === "Escape") setAddTarefaFrenteId(null);
                                    }}
                                    placeholder="Nome da tarefa…"
                                    className="h-6 flex-1 text-[11px]"
                                  />
                                  <button
                                    onClick={() => setAddTarefaFrenteId(null)}
                                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                                    aria-label="Cancelar"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setAddTarefaFrenteId(row.frente.id);
                                    setNovaTarefaTitulo("");
                                  }}
                                  className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-ink"
                                >
                                  <Plus className="h-3 w-3" /> tarefa
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Timeline scrollável */}
                  <div ref={scrollRef} className="flex-1 overflow-x-auto">
                    <div ref={timelineRef} className="relative" style={{ minWidth: `${columns.length * colWidth}px` }}>
                      <div className="relative flex h-10 border-b">
                        {columns.map((col, i) => (
                          <div key={i} className="flex flex-1 items-center justify-center border-r last:border-r-0">
                            <span className="text-[10px] font-medium capitalize text-muted-foreground">
                              {col.label}
                            </span>
                          </div>
                        ))}
                        {todayPct >= 0 && (
                          <div
                            className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-red-500"
                            style={{ left: `${todayPct}%` }}
                          >
                            <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-t-sm bg-red-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
                              HOJE
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
                          {columns.map((_, i) => (
                            <div key={i} className="flex-1 border-r border-dashed border-border last:border-r-0" />
                          ))}
                        </div>
                        {todayPct >= 0 && (
                          <div
                            className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-red-500"
                            style={{ left: `${todayPct}%` }}
                          />
                        )}

                        {frenteRows.map((row) => {
                          const expandida = !recolhidas.has(row.frente.id);
                          const g = row.bar ? geom("frente", row.frente.id, row.bar) : null;
                          return (
                            <div key={row.frente.id}>
                              <div className="relative border-b" style={{ height: ROW_H }}>
                                {g ? (
                                  <div
                                    className={cn(
                                      "absolute top-3 flex h-8 items-center rounded-md border border-black/5 shadow-sm",
                                      ESTADO_BAR[row.estado]
                                    )}
                                    style={{ left: `${g.leftPct}%`, width: `${g.widthPct}%`, minWidth: "40px" }}
                                  >
                                    {canEdit && (
                                      <div
                                        className="group/h absolute left-0 top-0 bottom-0 z-10 flex w-4 cursor-col-resize items-center justify-center gap-0.5 rounded-l-md hover:bg-black/20"
                                        onMouseDown={(e) => startDrag(e, "frente", row.frente.id, "left", row.bar!)}
                                      >
                                        <div className="h-3.5 w-px bg-white/60 group-hover/h:bg-white" />
                                        <div className="h-3.5 w-px bg-white/60 group-hover/h:bg-white" />
                                      </div>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (dragMovedRef.current) {
                                          dragMovedRef.current = false;
                                          return;
                                        }
                                        setSelecionada(row.frente);
                                      }}
                                      onMouseDown={(e) =>
                                        canEdit && startDrag(e, "frente", row.frente.id, "move", row.bar!)
                                      }
                                      title={`${row.frente.nome} · ${ESTADO_LABEL[row.estado]}${row.total > 0 ? ` · ${row.progresso}%` : ""}`}
                                      className={cn(
                                        "flex flex-1 items-center overflow-hidden px-2.5",
                                        canEdit ? "mx-3 cursor-grab active:cursor-grabbing" : ""
                                      )}
                                    >
                                      <span className="truncate text-[10px] font-semibold text-white">
                                        {row.total > 0 ? `${row.progresso}%` : row.frente.nome}
                                      </span>
                                    </button>
                                    {canEdit && (
                                      <div
                                        className="group/h absolute right-0 top-0 bottom-0 z-10 flex w-4 cursor-col-resize items-center justify-center gap-0.5 rounded-r-md hover:bg-black/20"
                                        onMouseDown={(e) => startDrag(e, "frente", row.frente.id, "right", row.bar!)}
                                      >
                                        <div className="h-3.5 w-px bg-white/60 group-hover/h:bg-white" />
                                        <div className="h-3.5 w-px bg-white/60 group-hover/h:bg-white" />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="absolute top-4 left-2 text-[10px] italic text-muted-foreground">
                                    defina o período da etapa
                                  </div>
                                )}
                              </div>

                              {expandida &&
                                row.tarefas.map((t) => {
                                  const tg = t.bar ? geom("tarefa", t.tarefa.id, t.bar) : null;
                                  return (
                                    <div
                                      key={t.tarefa.id}
                                      className="relative border-b bg-white/40"
                                      style={{ height: SUB_H }}
                                    >
                                      {tg && (
                                        <div
                                          className={cn(
                                            "absolute top-2 flex h-5 items-center rounded border border-black/5 shadow-sm",
                                            ESTADO_TAREFA_BAR[t.estado]
                                          )}
                                          style={{ left: `${tg.leftPct}%`, width: `${tg.widthPct}%`, minWidth: "28px" }}
                                        >
                                          {canEdit && (
                                            <div
                                              className="absolute left-0 top-0 bottom-0 z-10 flex w-3 cursor-col-resize items-center justify-center gap-px rounded-l hover:bg-black/20"
                                              onMouseDown={(e) => startDrag(e, "tarefa", t.tarefa.id, "left", t.bar!)}
                                            >
                                              <div className="h-2.5 w-px bg-white/70" />
                                              <div className="h-2.5 w-px bg-white/70" />
                                            </div>
                                          )}
                                          <button
                                            onClick={() => {
                                              if (dragMovedRef.current) {
                                                dragMovedRef.current = false;
                                                return;
                                              }
                                              setSelecionada(row.frente);
                                            }}
                                            onMouseDown={(e) =>
                                              canEdit && startDrag(e, "tarefa", t.tarefa.id, "move", t.bar!)
                                            }
                                            title={`${t.tarefa.titulo} · ${ESTADO_TAREFA_LABEL[t.estado]} · ${t.tarefa.data_inicio} → ${t.tarefa.prazo}`}
                                            className={cn(
                                              "flex flex-1 items-center overflow-hidden px-1.5",
                                              canEdit ? "mx-2.5 cursor-grab active:cursor-grabbing" : ""
                                            )}
                                          >
                                            <span className="truncate text-[9px] font-medium text-white">
                                              {t.tarefa.titulo}
                                            </span>
                                          </button>
                                          {canEdit && (
                                            <div
                                              className="absolute right-0 top-0 bottom-0 z-10 flex w-3 cursor-col-resize items-center justify-center gap-px rounded-r hover:bg-black/20"
                                              onMouseDown={(e) => startDrag(e, "tarefa", t.tarefa.id, "right", t.bar!)}
                                            >
                                              <div className="h-2.5 w-px bg-white/70" />
                                              <div className="h-2.5 w-px bg-white/70" />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                              {expandida && canEdit && (
                                <div className="border-b bg-white/40" style={{ height: SUB_H }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {temTimeline && (
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
              {canEdit && <span className="text-muted-foreground/50">↔ arraste as bordas para ajustar as datas</span>}
            </div>
          )}

          {semPrazo.length > 0 && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-xs text-warning-strong">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {semPrazo.length} etapa{semPrazo.length > 1 ? "s" : ""} sem período (fora da linha do tempo)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {semPrazo.map((f) => (
                    <Button
                      key={f.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelecionada(f)}
                    >
                      <Layers className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      {f.nome}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {semFrente.length > 0 && (
            <button
              onClick={() => setSelecionada(null)}
              className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white p-4 text-left transition-colors hover:bg-muted/30"
            >
              <span className="text-sm font-medium text-ink">Tarefas sem etapa</span>
              <span className="text-xs text-muted-foreground">
                {semFrente.filter((t) => t.status !== "concluida").length} aberta
                {semFrente.filter((t) => t.status !== "concluida").length === 1 ? "" : "s"}
              </span>
            </button>
          )}
        </>
      )}

      {/* Criar etapa */}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-black/10 p-3">
          <div className="flex-1">
            <Input
              value={novaEtapa}
              onChange={(e) => setNovaEtapa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEtapa()}
              placeholder="Nova etapa (fundação, alvenaria…)"
              className="h-9 min-w-[12rem]"
            />
          </div>
          <DatePicker
            value={novoInicio}
            onChange={setNovoInicio}
            placeholder="Início"
            className="h-9 w-36"
            maxDate={novoFim || undefined}
          />
          <DatePicker
            value={novoFim}
            onChange={setNovoFim}
            placeholder="Fim"
            className="h-9 w-36"
            minDate={novoInicio || undefined}
          />
          <Button variant="outline" size="sm" onClick={addEtapa} disabled={!novaEtapa.trim() || createFrente.isPending}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar etapa
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
