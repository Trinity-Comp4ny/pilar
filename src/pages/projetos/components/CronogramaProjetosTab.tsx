import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronDown, Layers, ZoomIn, ZoomOut, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Projeto, getDeadlineStatus, isDiscAtrasada } from "@/types/projetos";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";
import {
  addDays,
  diffDays,
  endOfMonth,
  generateColumns,
  parseDate,
  snapToBoundary,
  startOfMonth,
  toIso,
  type ZoomLevel,
} from "@/lib/cronograma";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
}

function MultiSelect({ options, selected, onChange, placeholder, searchPlaceholder }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const label =
    selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs w-[160px] justify-between font-normal",
            selected.length > 0 && "border-foreground"
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? "Buscar..."} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-center text-muted-foreground">Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {selected.length > 0 && (
                <CommandItem onSelect={() => onChange([])} className="text-xs text-muted-foreground">
                  Limpar seleção
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem key={opt} onSelect={() => toggle(opt)} className="text-xs gap-2">
                  <Checkbox checked={selected.includes(opt)} className="pointer-events-none" />
                  <span className="truncate">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface CronogramaProjetosTabProps {
  projetos: Projeto[];
  /** Grava a nova data ao arrastar a barra. Sem isto, as barras não arrastam. */
  onDatesChange?: (projetoId: string, updates: { data_inicio: string; data_previsao: string }) => Promise<void>;
}

type DragType = "left" | "right" | "move";

interface DragState {
  projIdx: number;
  type: DragType;
  startX: number;
  origStart: Date;
  origEnd: Date;
}

interface DragOverride {
  projIdx: number;
  start: Date;
  end: Date;
  type: DragType;
}

const STATUS_BAR_COLORS: Record<string, string> = {
  [PROJECT_STATUS.PLANEJAMENTO]: "bg-yellow-500",
  [PROJECT_STATUS.EM_ANDAMENTO]: "bg-blue-500",
  [PROJECT_STATUS.REVISAO]: "bg-purple-500",
  [PROJECT_STATUS.PARALISADO]: "bg-brand",
  [PROJECT_STATUS.CONCLUIDO]: "bg-positive/100",
  [PROJECT_STATUS.CANCELADO]: "bg-red-500",
};

function formatDateBR(d: string | undefined | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("pt-BR");
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function CronogramaProjetosTab({ projetos, onDatesChange }: CronogramaProjetosTabProps) {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [responsavelFilter, setResponsavelFilter] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Drag state via ref (closures estáveis) + estado mínimo para re-render.
  const dragRef = useRef<DragState | null>(null);
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [guideX, setGuideX] = useState<number | null>(null);
  // Marca que a barra realmente mudou de data no arraste, pra o clique de soltar
  // não navegar pro projeto logo em seguida.
  const draggedRef = useRef(false);
  const zoomRef = useRef<ZoomLevel>(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const { clienteOptions, responsavelOptions } = useMemo(() => {
    const clientes = new Set<string>();
    const responsaveis = new Set<string>();
    for (const p of projetos) {
      if (p.cliente_nome) clientes.add(p.cliente_nome);
      for (const d of p.disciplinas || []) {
        if (d.responsavel_nome) responsaveis.add(d.responsavel_nome);
      }
    }
    return {
      clienteOptions: Array.from(clientes).sort(),
      responsavelOptions: Array.from(responsaveis).sort(),
    };
  }, [projetos]);

  const visibleProjetos = useMemo(() => {
    return projetos
      .filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (clienteFilter.length > 0 && !clienteFilter.includes(p.cliente_nome ?? "")) return false;
        if (responsavelFilter.length > 0) {
          const hasResp = (p.disciplinas || []).some((d) => responsavelFilter.includes(d.responsavel_nome ?? ""));
          if (!hasResp) return false;
        }
        return parseDate(p.data_inicio) && parseDate(p.data_previsao);
      })
      .sort((a, b) => {
        const da = parseDate(a.data_inicio)!;
        const db = parseDate(b.data_inicio)!;
        return da.getTime() - db.getTime();
      });
  }, [projetos, statusFilter, clienteFilter, responsavelFilter]);

  const { timelineStart, timelineEnd, columns, rows } = useMemo(() => {
    if (visibleProjetos.length === 0) {
      return { timelineStart: new Date(), timelineEnd: new Date(), columns: [], rows: [] };
    }

    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const p of visibleProjetos) {
      const start = parseDate(p.data_inicio);
      const end = parseDate(p.data_final) || parseDate(p.data_previsao);
      if (start && (!minDate || start < minDate)) minDate = start;
      if (end && (!maxDate || end > maxDate)) maxDate = end;
    }

    const tlStart = startOfMonth(minDate || new Date());
    const tlEnd = endOfMonth(addDays(maxDate || addDays(tlStart, 180), 14));
    const cols = generateColumns(tlStart, tlEnd, zoom);
    const totalDays = diffDays(tlStart, tlEnd);

    const rowData = visibleProjetos.map((p) => {
      const start = parseDate(p.data_inicio)!;
      const end = parseDate(p.data_final) || parseDate(p.data_previsao)!;
      const ds = getDeadlineStatus(p);
      const atrasado = ds?.status_data === "em_atraso";
      const barClass = STATUS_BAR_COLORS[p.status] || "bg-gray-400";
      const totalDiscs = (p.disciplinas || []).length;
      const discAtrasadas = (p.disciplinas || []).filter((d) => isDiscAtrasada(d)).length;

      let leftPct = 0;
      let widthPct = 0;
      if (totalDays > 0) {
        leftPct = Math.max(0, (diffDays(tlStart, start) / totalDays) * 100);
        widthPct = Math.max(1, (diffDays(start, end) / totalDays) * 100);
      }
      if (leftPct + widthPct > 100) widthPct = 100 - leftPct;

      return {
        projeto: p,
        start,
        end,
        atrasado,
        deadlineStatus: ds,
        barClass,
        leftPct,
        widthPct,
        totalDiscs,
        discAtrasadas,
      };
    });

    return { timelineStart: tlStart, timelineEnd: tlEnd, columns: cols, rows: rowData };
  }, [visibleProjetos, zoom]);

  const todayPct = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = diffDays(timelineStart, timelineEnd);
    if (totalDays <= 0) return -1;
    const pct = (diffDays(timelineStart, today) / totalDays) * 100;
    return pct >= 0 && pct <= 100 ? pct : -1;
  }, [timelineStart, timelineEnd]);

  const scrollToToday = () => {
    if (!scrollRef.current || todayPct < 0) return;
    const container = scrollRef.current;
    const target = (todayPct / 100) * container.scrollWidth - container.clientWidth / 2;
    container.scrollTo({ left: target, behavior: "smooth" });
  };

  useEffect(() => {
    if (todayPct >= 0) scrollToToday();
  }, [todayPct]);

  // ── Arraste das barras (edita data do projeto) ───────────────────────────────

  const pxPerDay = useCallback((): number => {
    if (!timelineRef.current) return 1;
    const totalDays = diffDays(timelineStart, timelineEnd);
    return totalDays > 0 ? timelineRef.current.offsetWidth / totalDays : 1;
  }, [timelineStart, timelineEnd]);

  const startDrag = useCallback(
    (clientX: number, projIdx: number, type: DragType) => {
      if (!onDatesChange) return;
      const row = rows[projIdx];
      if (!row?.start || !row?.end) return;
      draggedRef.current = false;
      dragRef.current = {
        projIdx,
        type,
        startX: clientX,
        origStart: new Date(row.start),
        origEnd: new Date(row.end),
      };
    },
    [rows, onDatesChange]
  );

  useEffect(() => {
    const resetDrag = () => {
      dragRef.current = null;
      setDragOverride(null);
      setGuideX(null);
    };

    const applyDragDelta = (clientX: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaDays = Math.round((clientX - drag.startX) / pxPerDay());
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

      if (toIso(newStart) !== toIso(drag.origStart) || toIso(newEnd) !== toIso(drag.origEnd)) {
        draggedRef.current = true;
      }
      setDragOverride({ projIdx: drag.projIdx, start: newStart, end: newEnd, type: drag.type });
    };

    const trackGuide = (clientX: number) => {
      if (timelineRef.current && scrollRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        setGuideX(Math.max(0, clientX - rect.left + scrollRef.current.scrollLeft));
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      trackGuide(e.clientX);
      applyDragDelta(e.clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      trackGuide(touch.clientX);
      applyDragDelta(touch.clientX);
    };

    const commitDrag = async () => {
      const drag = dragRef.current;
      const override = dragOverride;
      resetDrag();

      if (!drag || !override || !onDatesChange) return;
      if (toIso(override.start) === toIso(drag.origStart) && toIso(override.end) === toIso(drag.origEnd)) return;

      const projetoId = rows[override.projIdx]?.projeto.id;
      if (!projetoId) return;

      setIsSaving(true);
      try {
        await onDatesChange(projetoId, {
          data_inicio: toIso(override.start),
          data_previsao: toIso(override.end),
        });
      } finally {
        setIsSaving(false);
      }
    };

    const onMouseUp = () => commitDrag();
    const onTouchEnd = () => commitDrag();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current) resetDrag();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dragOverride, onDatesChange, pxPerDay, rows]);

  const getBarGeometry = (rowIdx: number) => {
    const totalDays = diffDays(timelineStart, timelineEnd);
    if (totalDays <= 0) return null;
    const override = dragOverride?.projIdx === rowIdx ? dragOverride : null;
    const start = override ? override.start : rows[rowIdx].start;
    const end = override ? override.end : rows[rowIdx].end;
    if (!start || !end) return null;
    const leftPct = Math.max(0, (diffDays(timelineStart, start) / totalDays) * 100);
    let widthPct = Math.max(1, (diffDays(start, end) / totalDays) * 100);
    if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
    return { leftPct, widthPct, start, end };
  };

  const guideDateLabel = (): string => {
    if (guideX === null || !timelineRef.current) return "";
    const totalDays = diffDays(timelineStart, timelineEnd);
    const totalWidth = timelineRef.current.offsetWidth;
    if (totalWidth <= 0) return "";
    const dayOffset = Math.round((guideX / totalWidth) * totalDays);
    return formatDateShort(addDays(timelineStart, Math.max(0, Math.min(totalDays, dayOffset))));
  };

  const getDragLabel = (geo: { start: Date; end: Date }, type: DragType): string => {
    const durLabel = `${diffDays(geo.start, geo.end)}d`;
    if (type === "left") return `Início: ${formatDateBR(geo.start)} · ${durLabel}`;
    if (type === "right") return `Previsão: ${formatDateBR(geo.end)} · ${durLabel}`;
    return `${formatDateBR(geo.start)} → ${formatDateBR(geo.end)} · ${durLabel}`;
  };

  const statusOptions: Array<{ value: ProjectStatus | "all"; label: string }> = [
    { value: "all", label: "Todos os status" },
    ...Object.values(PROJECT_STATUS).map((s) => ({ value: s, label: PROJECT_STATUS_CONFIG[s].label })),
  ];

  if (projetos.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum projeto cadastrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const projetosSemDatas = projetos.filter((p) => !parseDate(p.data_inicio) || !parseDate(p.data_previsao));
  const isDragging = dragRef.current !== null || dragOverride !== null;

  return (
    <div className="space-y-4" style={{ userSelect: isDragging ? "none" : undefined }}>
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Title + zoom controls */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Cronograma de Projetos</h3>
                <span className="text-[11px] text-muted-foreground">
                  {visibleProjetos.length} projeto{visibleProjetos.length === 1 ? "" : "s"}
                </span>
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

            {/* Filters row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProjectStatus | "all")}>
                <SelectTrigger className="h-7 text-xs w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {clienteOptions.length > 0 && (
                <MultiSelect
                  options={clienteOptions}
                  selected={clienteFilter}
                  onChange={setClienteFilter}
                  placeholder="Cliente"
                  searchPlaceholder="Buscar cliente..."
                />
              )}
              {responsavelOptions.length > 0 && (
                <MultiSelect
                  options={responsavelOptions}
                  selected={responsavelFilter}
                  onChange={setResponsavelFilter}
                  placeholder="Responsável"
                  searchPlaceholder="Buscar responsável..."
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {projetosSemDatas.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {projetosSemDatas.length} projeto{projetosSemDatas.length > 1 ? "s" : ""} sem data de início ou previsão:{" "}
            {projetosSemDatas
              .slice(0, 3)
              .map((p) => p.codigo_projeto)
              .join(", ")}
            {projetosSemDatas.length > 3 ? ` e mais ${projetosSemDatas.length - 3}` : ""}
          </span>
        </div>
      )}

      {visibleProjetos.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Layers className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum projeto com datas para exibir</p>
              <p className="text-xs mt-1">Ajuste o filtro de status ou cadastre datas de início/previsão</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex">
              {/* Fixed left column */}
              <div className="flex-shrink-0 w-[260px] border-r bg-muted/30">
                <div className="h-10 border-b px-3 flex items-center">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Projeto
                  </span>
                </div>
                {rows.map((row) => {
                  const cfg = PROJECT_STATUS_CONFIG[row.projeto.status];
                  return (
                    <button
                      key={row.projeto.id}
                      onClick={() => navigate(`/projetos/${row.projeto.id}#cronograma`)}
                      className={cn(
                        "w-full h-14 border-b px-3 flex flex-col justify-center text-left hover:bg-muted/50 transition-colors",
                        row.atrasado && "bg-red-50/40"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {row.projeto.codigo_projeto}
                        </span>
                        {row.atrasado && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-medium truncate">{row.projeto.nome}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0", row.barClass)}
                          aria-hidden
                        />
                        <span className="text-[10px] text-muted-foreground truncate">
                          {cfg?.label || row.projeto.status}
                          {row.projeto.cliente_nome && ` · ${row.projeto.cliente_nome}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Scrollable timeline */}
              <div ref={scrollRef} className="flex-1 overflow-x-auto">
                <div
                  ref={timelineRef}
                  className="relative"
                  style={{
                    minWidth: zoom === "weeks" ? `${columns.length * 80}px` : `${columns.length * 120}px`,
                  }}
                >
                  {/* Header */}
                  <div className="h-10 border-b flex sticky top-0 bg-background z-10 relative">
                    {columns.map((col, i) => (
                      <div key={i} className="flex-1 border-r last:border-r-0 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-muted-foreground capitalize">{col.label}</span>
                      </div>
                    ))}

                    {/* HOJE chip in sticky header */}
                    {todayPct >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                        style={{ left: `${todayPct}%` }}
                      >
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1.5 py-0.5 font-bold whitespace-nowrap rounded-t-sm z-10">
                          HOJE
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rows */}
                  <div className="relative">
                    {/* Grid */}
                    <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                      {columns.map((_, i) => (
                        <div key={i} className="flex-1 border-r last:border-r-0 border-dashed border-gray-100" />
                      ))}
                    </div>

                    {/* Today line */}
                    {todayPct >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                        style={{ left: `${todayPct}%` }}
                      />
                    )}

                    {/* Vertical guide line during drag */}
                    {guideX !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-400/70 z-30 pointer-events-none"
                        style={{ left: `${guideX}px` }}
                      >
                        <div className="absolute top-1 left-2 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap shadow-md font-medium">
                          {guideDateLabel()}
                        </div>
                      </div>
                    )}

                    <TooltipProvider delayDuration={200}>
                      {rows.map((row, i) => {
                        const cfg = PROJECT_STATUS_CONFIG[row.projeto.status];
                        const geo = getBarGeometry(i);
                        const isThisDragging = dragOverride?.projIdx === i;
                        const canDrag = !!onDatesChange && !!geo;
                        if (!geo) return <div key={row.projeto.id} className="h-14 border-b relative" />;

                        return (
                          <div
                            key={row.projeto.id}
                            className={cn("h-14 border-b relative", row.atrasado && "bg-red-50/20")}
                          >
                            <Tooltip open={isThisDragging ? false : undefined}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "absolute top-3 h-8 rounded-md flex items-center overflow-visible shadow-sm border border-black/5 transition-shadow",
                                    row.barClass,
                                    row.atrasado && "ring-2 ring-red-300 ring-offset-1",
                                    isThisDragging && "opacity-90 ring-2 ring-white/60 shadow-md"
                                  )}
                                  style={{
                                    left: `${geo.leftPct}%`,
                                    width: `${geo.widthPct}%`,
                                    minWidth: "32px",
                                  }}
                                >
                                  {/* Left handle — arrasta o início */}
                                  {canDrag && (
                                    <div
                                      className="absolute left-0 top-0 bottom-0 w-4 cursor-col-resize z-10 flex items-center justify-center group/handle rounded-l-md hover:bg-black/20 transition-colors"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startDrag(e.clientX, i, "left");
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation();
                                        startDrag(e.touches[0].clientX, i, "left");
                                      }}
                                    >
                                      <div className="flex gap-[3px]">
                                        <div className="w-px h-3.5 bg-white/55 rounded group-hover/handle:bg-white transition-colors" />
                                        <div className="w-px h-3.5 bg-white/55 rounded group-hover/handle:bg-white transition-colors" />
                                      </div>
                                    </div>
                                  )}

                                  {/* Body — mover / clicar para abrir */}
                                  <div
                                    className={cn(
                                      "flex-1 flex items-center overflow-hidden",
                                      canDrag ? "mx-4 cursor-grab active:cursor-grabbing" : "mx-2.5 cursor-pointer"
                                    )}
                                    onMouseDown={
                                      canDrag
                                        ? (e) => {
                                            e.preventDefault();
                                            startDrag(e.clientX, i, "move");
                                          }
                                        : undefined
                                    }
                                    onTouchStart={
                                      canDrag ? (e) => startDrag(e.touches[0].clientX, i, "move") : undefined
                                    }
                                    onClick={() => {
                                      if (dragRef.current || draggedRef.current) {
                                        draggedRef.current = false;
                                        return;
                                      }
                                      navigate(`/projetos/${row.projeto.id}#cronograma`);
                                    }}
                                  >
                                    <span className="text-[10px] text-white font-medium truncate">
                                      {row.projeto.nome}
                                    </span>
                                  </div>

                                  {/* Right handle — arrasta a previsão */}
                                  {canDrag && (
                                    <div
                                      className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-10 flex items-center justify-center group/handle rounded-r-md hover:bg-black/20 transition-colors"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startDrag(e.clientX, i, "right");
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation();
                                        startDrag(e.touches[0].clientX, i, "right");
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
                                  <p className="font-semibold text-sm">{row.projeto.nome}</p>
                                  <div className="flex items-center gap-2">
                                    {cfg && <Badge className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>}
                                    {row.deadlineStatus && (
                                      <Badge className={cn("text-[10px]", row.deadlineStatus.color)}>
                                        {row.deadlineStatus.label}
                                        {row.deadlineStatus.days > 0 ? ` (${row.deadlineStatus.days}d)` : ""}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    <p>Código: {row.projeto.codigo_projeto}</p>
                                    {row.projeto.cliente_nome && <p>Cliente: {row.projeto.cliente_nome}</p>}
                                    <p>Início: {formatDateBR(geo.start)}</p>
                                    <p>Previsão: {formatDateBR(geo.end)}</p>
                                    {row.projeto.data_final && <p>Conclusão: {formatDateBR(row.projeto.data_final)}</p>}
                                    <p className="text-muted-foreground/60">Duração: {diffDays(geo.start, geo.end)} dias</p>
                                    {row.totalDiscs > 0 && (
                                      <p>
                                        {row.totalDiscs} disciplina{row.totalDiscs === 1 ? "" : "s"}
                                        {row.discAtrasadas > 0 && (
                                          <span className="text-red-500 ml-1">
                                            · {row.discAtrasadas} atrasada{row.discAtrasadas === 1 ? "" : "s"}
                                          </span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground/60 border-t pt-1 mt-1">
                                    {canDrag ? "Arraste as bordas para ajustar as datas" : "Clique para abrir o cronograma"}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>

                            {/* Floating drag label — segue o cursor */}
                            {isThisDragging && guideX !== null && (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 z-40 pointer-events-none"
                                style={{ left: `${guideX + 14}px` }}
                              >
                                <div className="bg-gray-900/90 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg font-medium">
                                  {getDragLabel(geo, dragOverride.type)}
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
      )}

      {/* Legend */}
      <div className="flex items-center justify-center flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_BAR_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-6 rounded-sm", color)} />
            <span>{PROJECT_STATUS_CONFIG[status as ProjectStatus]?.label || status}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-0.5 bg-red-500" />
          <span>Hoje</span>
        </div>
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
