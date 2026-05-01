import { useEffect, useMemo, useRef, useState } from "react";
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
}

type ZoomLevel = "months" | "weeks";

const STATUS_BAR_COLORS: Record<string, string> = {
  [PROJECT_STATUS.PLANEJAMENTO]: "bg-yellow-500",
  [PROJECT_STATUS.EM_ANDAMENTO]: "bg-blue-500",
  [PROJECT_STATUS.REVISAO]: "bg-purple-500",
  [PROJECT_STATUS.PARALISADO]: "bg-brand",
  [PROJECT_STATUS.CONCLUIDO]: "bg-positive/100",
  [PROJECT_STATUS.CANCELADO]: "bg-red-500",
};

function parseDate(d: string | undefined | null): Date | null {
  if (!d) return null;
  const date = new Date(d + "T00:00:00");
  return isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateBR(d: string | undefined | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("pt-BR");
}

interface TimelineColumn {
  label: string;
  start: Date;
  end: Date;
}

function generateColumns(timelineStart: Date, timelineEnd: Date, zoom: ZoomLevel): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  if (zoom === "months") {
    let current = startOfMonth(timelineStart);
    while (current <= timelineEnd) {
      const monthEnd = endOfMonth(current);
      cols.push({
        label: formatMonthYear(current),
        start: new Date(current),
        end: monthEnd > timelineEnd ? new Date(timelineEnd) : monthEnd,
      });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
  } else {
    let current = startOfWeek(timelineStart);
    while (current <= timelineEnd) {
      const weekEnd = addDays(current, 6);
      cols.push({
        label: formatWeekLabel(current),
        start: new Date(current),
        end: weekEnd > timelineEnd ? new Date(timelineEnd) : weekEnd,
      });
      current = addDays(current, 7);
    }
  }
  return cols;
}

export function CronogramaProjetosTab({ projetos }: CronogramaProjetosTabProps) {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [responsavelFilter, setResponsavelFilter] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="space-y-4">
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

                    <TooltipProvider delayDuration={200}>
                      {rows.map((row) => {
                        const cfg = PROJECT_STATUS_CONFIG[row.projeto.status];
                        return (
                          <div
                            key={row.projeto.id}
                            className={cn("h-14 border-b relative", row.atrasado && "bg-red-50/20")}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => navigate(`/projetos/${row.projeto.id}#cronograma`)}
                                  className={cn(
                                    "absolute top-3 h-8 rounded-md flex items-center px-2.5 shadow-sm border border-black/5 hover:shadow-md transition-shadow cursor-pointer",
                                    row.barClass,
                                    row.atrasado && "ring-2 ring-red-300 ring-offset-1"
                                  )}
                                  style={{
                                    left: `${row.leftPct}%`,
                                    width: `${row.widthPct}%`,
                                    minWidth: "32px",
                                  }}
                                >
                                  <span className="text-[10px] text-white font-medium truncate">
                                    {row.projeto.nome}
                                  </span>
                                </button>
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
                                    <p>Início: {formatDateBR(row.projeto.data_inicio)}</p>
                                    <p>Previsão: {formatDateBR(row.projeto.data_previsao)}</p>
                                    {row.projeto.data_final && <p>Conclusão: {formatDateBR(row.projeto.data_final)}</p>}
                                    <p className="text-muted-foreground/60">
                                      Duração: {diffDays(row.start, row.end)} dias
                                    </p>
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
                                    Clique para abrir o cronograma do projeto
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
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
      </div>
    </div>
  );
}
