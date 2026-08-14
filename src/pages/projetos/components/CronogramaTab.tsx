import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, User, AlertTriangle, Layers, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type GanttDragType,
  type ZoomLevel,
  parseDate,
  addDays,
  diffDays,
  endOfMonth,
  generateColumns,
  barPosition,
  toIso,
} from "@/lib/cronograma";
import { useGanttDrag } from "@/components/gantt/useGanttDrag";
import {
  type DisciplinaResponsavel,
  isDiscAtrasada,
  getDiscDeadlineStatus,
  getResponsaveisList,
} from "@/types/projetos";

interface CronogramaTabProps {
  disciplinas: DisciplinaResponsavel[];
  projetoDataInicio?: string;
  projetoDataPrevisao?: string;
  onDatesChange?: (discIdx: number, updates: { data_inicio?: string; data_previsao?: string }) => Promise<void>;
  onDisciplinaClick?: (disc: DisciplinaResponsavel) => void;
}

const CHIP_COLLISION_PCT = 6;

interface MarkerDef {
  id: string;
  pct: number;
  label: string;
  lineClass: string;
  chipClass: string;
  chipRow: 0 | 1;
}

const STATUS_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  Concluído: { bar: "bg-positive/100", text: "text-positive-strong", bg: "bg-positive/10" },
  "Em Andamento": { bar: "bg-status-progress", text: "text-info-strong", bg: "bg-info-soft" },
  Pendente: { bar: "bg-status-planning", text: "text-warning-mid", bg: "bg-warning-soft" },
  "Não Iniciado": { bar: "bg-status-unknown", text: "text-ink-muted", bg: "bg-muted" },
};

function formatDateBR(d: string | undefined | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("pt-BR");
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function CronogramaTab({
  disciplinas,
  projetoDataInicio,
  projetoDataPrevisao,
  onDatesChange,
  onDisciplinaClick,
}: CronogramaTabProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  // collapsible section for disciplines without dates
  const [discsSemDatasExpanded, setDiscsSemDatasExpanded] = useState(false);

  const { timelineStart, timelineEnd, columns, rows } = useMemo(() => {
    if (disciplinas.length === 0) {
      return { timelineStart: new Date(), timelineEnd: new Date(), columns: [], rows: [] };
    }

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const disc of disciplinas) {
      const resps = getResponsaveisList(disc);
      const allDates = [
        parseDate(disc.data_inicio),
        parseDate(disc.data_previsao),
        parseDate(disc.data_final),
        ...resps.flatMap((r) => [parseDate(r.data_inicio), parseDate(r.data_previsao), parseDate(r.data_final)]),
      ].filter(Boolean) as Date[];

      for (const d of allDates) {
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }

    // Timeline anchors on project dates, not on current month
    const projStart = parseDate(projetoDataInicio);
    const projEnd = parseDate(projetoDataPrevisao);

    // Start: uma folga curta antes do início do projeto, só pra a linha de INÍCIO
    // não colar na borda esquerda (fica perto da borda, não no meio).
    const LEAD_DAYS = 4;
    const tlStart = addDays(projStart || minDate || new Date(), -LEAD_DAYS);

    // End: latest of project end OR latest discipline date (accommodates delays)
    const latestDate = [projEnd, maxDate]
      .filter(Boolean)
      .reduce<Date | null>((acc, d) => (!acc || (d && d > acc) ? d! : acc), null);
    const tlEnd = endOfMonth(addDays(latestDate || addDays(tlStart, 180), 14));

    const cols = generateColumns(tlStart, tlEnd, zoom);
    const totalDays = diffDays(tlStart, tlEnd);

    const rowData = disciplinas.map((disc) => {
      const resps = getResponsaveisList(disc);

      let start = parseDate(disc.data_inicio);
      let end = parseDate(disc.data_final) || parseDate(disc.data_previsao);

      if (!start || !end) {
        const respStarts = resps.map((r) => parseDate(r.data_inicio)).filter(Boolean) as Date[];
        const respEnds = resps
          .map((r) => parseDate(r.data_final) || parseDate(r.data_previsao))
          .filter(Boolean) as Date[];

        if (!start && respStarts.length > 0) start = respStarts.reduce((min, d) => (d < min ? d : min), respStarts[0]);
        if (!end && respEnds.length > 0) end = respEnds.reduce((max, d) => (d > max ? d : max), respEnds[0]);
      }

      const atrasada = isDiscAtrasada(disc);
      const deadlineStatus = getDiscDeadlineStatus(disc);
      const status = disc.status || "Não Iniciado";
      const colors = STATUS_COLORS[status] || STATUS_COLORS["Não Iniciado"];
      // Bar extends past project planned end (delayed)
      const beyondProjectEnd = !!(projEnd && end && end > projEnd);

      let leftPct = 0;
      let widthPct = 0;

      if (start && end) {
        ({ leftPct, widthPct } = barPosition(start, end, tlStart, tlEnd));
      } else if (start && totalDays > 0) {
        leftPct = Math.max(0, (diffDays(tlStart, start) / totalDays) * 100);
        widthPct = 2;
        if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
      }

      return { disc, start, end, resps, atrasada, deadlineStatus, status, colors, leftPct, widthPct, beyondProjectEnd };
    });

    return { timelineStart: tlStart, timelineEnd: tlEnd, columns: cols, rows: rowData };
  }, [disciplinas, projetoDataInicio, projetoDataPrevisao, zoom]);

  const todayPct = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = diffDays(timelineStart, timelineEnd);
    if (totalDays <= 0) return -1;
    const pct = (diffDays(timelineStart, today) / totalDays) * 100;
    return pct >= 0 && pct <= 100 ? pct : -1;
  }, [timelineStart, timelineEnd]);

  const { projetoInicioPct, projetoPrevisaoPct } = useMemo(() => {
    const totalDays = diffDays(timelineStart, timelineEnd);
    const toPct = (iso: string | undefined) => {
      const d = parseDate(iso);
      if (!d || totalDays <= 0) return -1;
      const pct = (diffDays(timelineStart, d) / totalDays) * 100;
      return pct >= 0 && pct <= 100 ? pct : -1;
    };
    return {
      projetoInicioPct: toPct(projetoDataInicio),
      projetoPrevisaoPct: toPct(projetoDataPrevisao),
    };
  }, [timelineStart, timelineEnd, projetoDataInicio, projetoDataPrevisao]);

  const scrollToToday = () => {
    if (!scrollRef.current || todayPct < 0) return;
    const container = scrollRef.current;
    const scrollTarget = (todayPct / 100) * container.scrollWidth - container.clientWidth / 2;
    container.scrollTo({ left: scrollTarget, behavior: "smooth" });
  };

  useEffect(() => {
    if (todayPct >= 0) scrollToToday();
  }, [todayPct]);

  // ── Drag: motor compartilhado + guarda-chuva do projeto ──────────────────────

  const {
    override: dragOverride,
    guideX,
    isSaving,
    isDragging,
    startDrag,
    getBarGeometry,
    guideDateLabel,
    shouldSuppressClick,
  } = useGanttDrag<number>({
    timelineStart,
    timelineEnd,
    zoom,
    enabled: !!onDatesChange,
    timelineRef,
    scrollRef,
    // Guarda-chuva: a disciplina não sai das datas do projeto (nem antes do
    // início, nem depois da previsão). Clampou ⇒ snapping ⇒ não salva.
    constrain: ({ start, end, type }) => {
      let newStart = start;
      let newEnd = end;
      let snapping = false;
      const projStart = parseDate(projetoDataInicio);
      const projEnd = parseDate(projetoDataPrevisao);
      const dur = diffDays(newStart, newEnd);

      if (projEnd && newEnd > projEnd) {
        newEnd = projEnd;
        if (type === "move") newStart = addDays(projEnd, -dur);
        snapping = true;
      }
      if (projStart && newStart < projStart) {
        newStart = projStart;
        if (type === "move") newEnd = addDays(projStart, dur);
        snapping = true;
      }
      if (projStart && newStart < projStart) newStart = projStart;
      if (projEnd && newEnd > projEnd) newEnd = projEnd;
      if (newStart >= newEnd && projStart && projEnd) {
        newStart = projStart;
        newEnd = projEnd;
      }
      return { start: newStart, end: newEnd, snapping };
    },
    skipCommitWhenSnapping: true,
    onCommit: async (rowIdx, { start, end }) => {
      if (!onDatesChange) return;
      await onDatesChange(rowIdx, { data_inicio: toIso(start), data_previsao: toIso(end) });
    },
  });

  const isSnapping = dragOverride?.snapping ?? false;

  // ── Drag tooltip label content ───────────────────────────────────────────────

  const getDragLabel = (geo: { start: Date; end: Date }, type: GanttDragType): string => {
    const dur = diffDays(geo.start, geo.end);
    const durLabel = `${dur}d`;
    if (type === "left") return `Início: ${formatDateBR(geo.start)} · ${durLabel}`;
    if (type === "right") return `Previsão: ${formatDateBR(geo.end)} · ${durLabel}`;
    return `${formatDateBR(geo.start)} → ${formatDateBR(geo.end)} · ${durLabel}`;
  };

  // ── Timeline markers (chips in sticky header + lines in rows) ───────────────

  const rawMarkers = [
    projetoInicioPct >= 0 && {
      id: "inicio",
      pct: projetoInicioPct,
      label: "INÍCIO",
      lineClass: "bg-emerald-500",
      chipClass: "bg-emerald-500",
    },
    todayPct >= 0 && {
      id: "hoje",
      pct: todayPct,
      label: "HOJE",
      lineClass: "bg-red-500",
      chipClass: "bg-red-500",
    },
    projetoPrevisaoPct >= 0 && {
      id: "previsao",
      pct: projetoPrevisaoPct,
      label: `PREV. · ${parseDate(projetoDataPrevisao) ? formatDateShort(parseDate(projetoDataPrevisao)!) : ""}`,
      lineClass: "bg-violet-500",
      chipClass: "bg-violet-500",
    },
  ].filter(Boolean) as Omit<MarkerDef, "chipRow">[];

  const sortedRaw = [...rawMarkers].sort((a, b) => a.pct - b.pct);

  // Build chipRows imperatively to avoid TDZ (can't self-reference inside .map)
  const chipRows: (0 | 1)[] = [];
  for (let i = 0; i < sortedRaw.length; i++) {
    if (i === 0) {
      chipRows.push(0);
    } else {
      const tooClose = sortedRaw[i].pct - sortedRaw[i - 1].pct < CHIP_COLLISION_PCT;
      chipRows.push(tooClose ? ((chipRows[i - 1] === 0 ? 1 : 0) as 0 | 1) : 0);
    }
  }

  const timelineMarkers: MarkerDef[] = sortedRaw.map((m, i) => ({ ...m, chipRow: chipRows[i] }));

  // ── Render ───────────────────────────────────────────────────────────────────

  if (disciplinas.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma disciplina definida</p>
            <p className="text-xs mt-1">Adicione disciplinas com datas para visualizar o cronograma</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const discsSemDatas = disciplinas.filter((d) => {
    if (d.data_inicio || d.data_previsao) return false;
    const resps = getResponsaveisList(d);
    return !resps.some((r) => r.data_inicio || r.data_previsao);
  });

  return (
    <div className="space-y-4" style={{ userSelect: isDragging ? "none" : undefined }}>
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Cronograma do Projeto</h3>
              {isSaving && <span className="text-[10px] text-muted-foreground animate-pulse">Salvando...</span>}
              {isDragging && (
                <span className="text-[10px] text-muted-foreground/60 border border-dashed border-muted-foreground/30 rounded px-1.5 py-0.5">
                  Esc para cancelar
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={scrollToToday}
                disabled={todayPct < 0}
              >
                Hoje
              </Button>
              <div className="flex items-center border rounded-md overflow-hidden">
                <Button
                  variant={zoom === "months" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-none px-2"
                  onClick={() => setZoom("months")}
                >
                  <ZoomOut className="h-3 w-3 mr-1" /> Meses
                </Button>
                <Button
                  variant={zoom === "weeks" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-none px-2"
                  onClick={() => setZoom("weeks")}
                >
                  <ZoomIn className="h-3 w-3 mr-1" /> Semanas
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {discsSemDatas.length > 0 && (
        <div className="rounded-lg border border-warning-mid-border bg-warning-soft text-warning-strong text-xs overflow-hidden">
          <button
            className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-amber-100/60 transition-colors"
            onClick={() => setDiscsSemDatasExpanded((v) => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1">
              {discsSemDatas.length} disciplina{discsSemDatas.length > 1 ? "s" : ""} sem datas definidas — não exibidas
              no gráfico
            </span>
            <span className="text-[10px] text-warning-mid opacity-70">{discsSemDatasExpanded ? "▲" : "▼"}</span>
          </button>
          {discsSemDatasExpanded && (
            <div className="border-t border-warning-mid-border px-3 py-2 space-y-0.5">
              {discsSemDatas.map((d) => (
                <div key={d.disciplina} className="flex items-center gap-1.5 py-0.5">
                  <span className="font-medium">{d.disciplina}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gantt */}
      <Card>
        <CardContent className="p-0">
          <div className="flex">
            {/* Fixed label column */}
            <div className="flex-shrink-0 w-[220px] border-r bg-muted/30">
              <div className="h-10 border-b px-3 flex items-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Disciplina
                </span>
              </div>
              {rows.map((row, i) => (
                <div
                  key={i}
                  className={cn("h-14 border-b px-3 flex flex-col justify-center", row.atrasada && "bg-danger-soft/40")}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{row.disc.disciplina}</span>
                    {row.atrasada && <AlertTriangle className="h-3 w-3 text-danger-mid flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <User className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground truncate">
                      {row.resps.map((r) => r.responsavel_nome).join(", ") || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Scrollable timeline area */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto">
              <div
                ref={timelineRef}
                className="relative"
                style={{ minWidth: zoom === "weeks" ? `${columns.length * 80}px` : `${columns.length * 120}px` }}
              >
                {/* Column headers — relative so marker chips live here (sticky = always visible) */}
                <div className="h-10 border-b flex sticky top-0 bg-background z-10 relative">
                  {columns.map((col, i) => (
                    <div key={i} className="flex-1 border-r last:border-r-0 flex items-center justify-center">
                      <span className="text-[10px] font-medium text-muted-foreground capitalize">{col.label}</span>
                    </div>
                  ))}

                  {/* Marker chips pinned inside sticky header */}
                  {timelineMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      className={cn("absolute top-0 bottom-0 w-0.5 pointer-events-none", marker.lineClass)}
                      style={{ left: `${marker.pct}%` }}
                    >
                      <div
                        className={cn(
                          "absolute left-1/2 -translate-x-1/2 text-white text-[8px] px-1.5 py-0.5 font-bold whitespace-nowrap z-10",
                          marker.chipClass,
                          marker.chipRow === 0 ? "bottom-0 rounded-t-sm" : "top-0 rounded-b-sm"
                        )}
                      >
                        {marker.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rows + bars */}
                <div className="relative">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                    {columns.map((_, i) => (
                      <div key={i} className="flex-1 border-r last:border-r-0 border-dashed border-border" />
                    ))}
                  </div>

                  {/* Marker vertical lines — chips live in the sticky header above */}
                  {timelineMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      className={cn("absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none", marker.lineClass)}
                      style={{ left: `${marker.pct}%` }}
                    />
                  ))}

                  {/* Vertical guide line during drag */}
                  {guideX !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-blue-400/70 z-30 pointer-events-none"
                      style={{ left: `${guideX}px` }}
                    >
                      {/* Date chip at top of guide */}
                      <div className="absolute top-1 left-2 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap shadow-md font-medium">
                        {guideDateLabel()}
                      </div>
                    </div>
                  )}

                  {/* Discipline rows */}
                  <TooltipProvider delayDuration={200}>
                    {rows.map((row, i) => {
                      const base = row.start && row.end ? { start: row.start, end: row.end } : null;
                      const geo = getBarGeometry(i, base);
                      const isThisDragging = dragOverride?.key === i;
                      const canDrag = !!onDatesChange && !!geo;
                      // During drag, recompute beyondProjectEnd from override dates
                      const projEndDate = parseDate(projetoDataPrevisao);
                      const effectiveEnd = isThisDragging && dragOverride ? dragOverride.end : row.end;
                      const isBeyondEnd = !!(projEndDate && effectiveEnd && effectiveEnd > projEndDate);

                      return (
                        <div key={i} className={cn("h-14 border-b relative", row.atrasada && "bg-danger-soft/20")}>
                          {geo && (
                            <Tooltip open={isThisDragging ? false : undefined}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "absolute top-3 h-8 rounded-md flex items-center overflow-visible shadow-sm border border-black/5 transition-shadow",
                                    row.colors.bar,
                                    row.atrasada && !isBeyondEnd && "ring-2 ring-danger-mid-border ring-offset-1",
                                    isBeyondEnd && !isThisDragging && "ring-2 ring-attention-mid-border ring-offset-1",
                                    isThisDragging &&
                                      !isSnapping &&
                                      !isBeyondEnd &&
                                      "opacity-90 ring-2 ring-white/60 shadow-md",
                                    isThisDragging &&
                                      (isSnapping || isBeyondEnd) &&
                                      "opacity-90 ring-2 ring-attention-mid-border ring-offset-1 shadow-md"
                                  )}
                                  style={{
                                    left: `${geo.leftPct}%`,
                                    width: `${geo.widthPct}%`,
                                    minWidth: "28px",
                                  }}
                                >
                                  {/* Left handle — drag start date */}
                                  {canDrag && (
                                    <div
                                      className="absolute left-0 top-0 bottom-0 w-4 cursor-col-resize z-10 flex items-center justify-center group/handle rounded-l-md hover:bg-black/20 transition-colors"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startDrag(e.clientX, i, "left", base);
                                      }}
                                      onTouchStart={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startDrag(e.touches[0].clientX, i, "left", base);
                                      }}
                                    >
                                      <div className="flex gap-[3px]">
                                        <div className="w-px h-3.5 bg-white/55 rounded group-hover/handle:bg-white transition-colors" />
                                        <div className="w-px h-3.5 bg-white/55 rounded group-hover/handle:bg-white transition-colors" />
                                      </div>
                                    </div>
                                  )}

                                  {/* Body — drag move / click to edit */}
                                  <div
                                    className={cn(
                                      "flex-1 flex items-center overflow-hidden",
                                      canDrag ? "mx-4 cursor-grab active:cursor-grabbing" : "mx-2",
                                      onDisciplinaClick && "cursor-pointer"
                                    )}
                                    onMouseDown={
                                      canDrag
                                        ? (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            startDrag(e.clientX, i, "move", base);
                                          }
                                        : undefined
                                    }
                                    onTouchStart={
                                      canDrag
                                        ? (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            startDrag(e.touches[0].clientX, i, "move", base);
                                          }
                                        : undefined
                                    }
                                    onClick={() => {
                                      if (shouldSuppressClick()) return;
                                      onDisciplinaClick?.(row.disc);
                                    }}
                                  >
                                    {/* Progress fill for Em Andamento */}
                                    {row.status === "Em Andamento" && row.start && row.end && (
                                      <div
                                        className="absolute inset-0 bg-status-progress/30 rounded-md"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            Math.max(
                                              0,
                                              (diffDays(row.start, new Date()) / diffDays(row.start, row.end)) * 100
                                            )
                                          )}%`,
                                        }}
                                      />
                                    )}
                                    <span className="text-[10px] text-white font-medium relative z-10 truncate">
                                      {row.disc.disciplina}
                                    </span>
                                  </div>

                                  {/* Right handle — drag end date */}
                                  {canDrag && (
                                    <div
                                      className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-10 flex items-center justify-center group/handle rounded-r-md hover:bg-black/20 transition-colors"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startDrag(e.clientX, i, "right", base);
                                      }}
                                      onTouchStart={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startDrag(e.touches[0].clientX, i, "right", base);
                                      }}
                                    >
                                      <div className="flex gap-[3px]">
                                        <div className="w-px h-3.5 bg-white/55 rounded group-hover/handle:bg-white transition-colors" />
                                        <div className="w-px h-3.5 bg-white/55 rounded group-hover/handle:bg-white transition-colors" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>

                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-sm">{row.disc.disciplina}</p>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={cn("text-[10px]", row.colors.bg, row.colors.text)}
                                    >
                                      {row.status}
                                    </Badge>
                                    {row.deadlineStatus && (
                                      <Badge className={cn("text-[10px]", row.deadlineStatus.color)}>
                                        {row.deadlineStatus.label}
                                        {row.deadlineStatus.days > 0 ? ` (${row.deadlineStatus.days}d)` : ""}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    <p>Início: {formatDateBR(geo.start)}</p>
                                    <p>Previsão: {formatDateBR(geo.end)}</p>
                                    {row.disc.data_final && <p>Conclusão: {formatDateBR(row.disc.data_final)}</p>}
                                    <p className="text-muted-foreground/60">
                                      Duração: {diffDays(geo.start, geo.end)} dias
                                    </p>
                                  </div>
                                  {row.resps.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Responsáveis: {row.resps.map((r) => r.responsavel_nome).join(", ")}
                                    </p>
                                  )}
                                  {canDrag && (
                                    <p className="text-[10px] text-muted-foreground/60 border-t pt-1 mt-1">
                                      Arraste as bordas para ajustar as datas
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Floating drag label — follows cursor, shows what's changing */}
                          {isThisDragging && geo && guideX !== null && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 z-40 pointer-events-none"
                              style={{ left: `${guideX + 14}px` }}
                            >
                              <div
                                className={cn(
                                  "text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg font-medium",
                                  isSnapping ? "bg-orange-600" : isBeyondEnd ? "bg-orange-500" : "bg-ink/90"
                                )}
                              >
                                {getDragLabel(geo, dragOverride.type)}
                                {isSnapping && <span className="ml-1.5 opacity-80">· antes do início do projeto</span>}
                                {!isSnapping && isBeyondEnd && (
                                  <span className="ml-1.5 opacity-80">· além da previsão</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center justify-center flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-6 rounded-sm", colors.bar)} />
            <span>{status}</span>
          </div>
        ))}
        {timelineMarkers.map((marker) => (
          <div key={marker.id} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-0.5", marker.lineClass)} />
            <span>
              {marker.id === "inicio" && "Início do projeto"}
              {marker.id === "hoje" && "Hoje"}
              {marker.id === "previsao" && "Previsão do projeto"}
            </span>
          </div>
        ))}
        {onDatesChange && (
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <span>↔</span>
            <span>Arraste as bordas para ajustar datas</span>
          </div>
        )}
      </div>
    </div>
  );
}
