import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, User, AlertTriangle, Layers, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type DisciplinaResponsavel,
  isDiscAtrasada,
  getDiscDeadlineStatus,
  getResponsaveisList,
  getProjectProgress,
} from "@/types/projetos";

interface CronogramaTabProps {
  disciplinas: DisciplinaResponsavel[];
  projetoDataInicio?: string;
  projetoDataPrevisao?: string;
}

type ZoomLevel = "months" | "weeks";

const STATUS_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  Concluído: { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50" },
  "Em Andamento": { bar: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50" },
  Pendente: { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  "Não Iniciado": { bar: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-50" },
};

function parseDate(d: string | undefined): Date | null {
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

function formatDateBR(d: string | undefined): string {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
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

export function CronogramaTab({ disciplinas, projetoDataInicio, projetoDataPrevisao }: CronogramaTabProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const scrollRef = useRef<HTMLDivElement>(null);

  const progress = getProjectProgress(disciplinas);

  const { timelineStart, timelineEnd, columns, rows } = useMemo(() => {
    if (disciplinas.length === 0) {
      return { timelineStart: new Date(), timelineEnd: new Date(), columns: [], rows: [] };
    }

    // Calcular range do timeline baseado nas datas das disciplinas e responsáveis
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

    // Fallback para datas do projeto
    if (!minDate) minDate = parseDate(projetoDataInicio) || new Date();
    if (!maxDate) maxDate = parseDate(projetoDataPrevisao) || addDays(minDate, 180);

    // Adicionar padding de 1 mês antes e depois
    const tlStart = startOfMonth(addDays(minDate, -15));
    const tlEnd = endOfMonth(addDays(maxDate, 15));

    const cols = generateColumns(tlStart, tlEnd, zoom);

    const totalDays = diffDays(tlStart, tlEnd);

    const rowData = disciplinas.map((disc) => {
      const resps = getResponsaveisList(disc);

      // Datas da disciplina, com fallback para min/max dos responsáveis
      let start = parseDate(disc.data_inicio);
      let end = parseDate(disc.data_final) || parseDate(disc.data_previsao);

      if (!start || !end) {
        const respStarts = resps.map((r) => parseDate(r.data_inicio)).filter(Boolean) as Date[];
        const respEnds = resps
          .map((r) => parseDate(r.data_final) || parseDate(r.data_previsao))
          .filter(Boolean) as Date[];

        if (!start && respStarts.length > 0) {
          start = respStarts.reduce((min, d) => (d < min ? d : min), respStarts[0]);
        }
        if (!end && respEnds.length > 0) {
          end = respEnds.reduce((max, d) => (d > max ? d : max), respEnds[0]);
        }
      }

      const atrasada = isDiscAtrasada(disc);
      const deadlineStatus = getDiscDeadlineStatus(disc);
      const status = disc.status || "Não Iniciado";
      const colors = STATUS_COLORS[status] || STATUS_COLORS["Não Iniciado"];

      let leftPct = 0;
      let widthPct = 0;

      if (start && end && totalDays > 0) {
        leftPct = Math.max(0, (diffDays(tlStart, start) / totalDays) * 100);
        widthPct = Math.max(1, (diffDays(start, end) / totalDays) * 100);
      } else if (start && totalDays > 0) {
        leftPct = Math.max(0, (diffDays(tlStart, start) / totalDays) * 100);
        widthPct = 2; // barra mínima
      }

      // Limitar para não ultrapassar
      if (leftPct + widthPct > 100) widthPct = 100 - leftPct;

      return {
        disc,
        start,
        end,
        resps,
        atrasada,
        deadlineStatus,
        status,
        colors,
        leftPct,
        widthPct,
      };
    });

    return { timelineStart: tlStart, timelineEnd: tlEnd, columns: cols, rows: rowData };
  }, [disciplinas, projetoDataInicio, projetoDataPrevisao, zoom]);

  // Posição do "hoje" na timeline
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
    const scrollTarget = (todayPct / 100) * container.scrollWidth - container.clientWidth / 2;
    container.scrollTo({ left: scrollTarget, behavior: "smooth" });
  };

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
    <div className="space-y-4">
      {/* Header com progresso e controles */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Cronograma do Projeto</h3>
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
              <div className="flex items-center border rounded-md">
                <Button
                  variant={zoom === "months" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-r-none px-2"
                  onClick={() => setZoom("months")}
                >
                  <ZoomOut className="h-3 w-3 mr-1" />
                  Meses
                </Button>
                <Button
                  variant={zoom === "weeks" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-l-none px-2"
                  onClick={() => setZoom("weeks")}
                >
                  <ZoomIn className="h-3 w-3 mr-1" />
                  Semanas
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{progress}% concluído</span>
          </div>
        </CardContent>
      </Card>

      {/* Aviso de disciplinas sem datas */}
      {discsSemDatas.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {discsSemDatas.length} disciplina{discsSemDatas.length > 1 ? "s" : ""} sem datas definidas:{" "}
            {discsSemDatas.map((d) => d.disciplina).join(", ")}
          </span>
        </div>
      )}

      {/* Gantt Chart */}
      <Card>
        <CardContent className="p-0">
          <div className="flex">
            {/* Coluna fixa com nomes das disciplinas */}
            <div className="flex-shrink-0 w-[220px] border-r bg-muted/30">
              {/* Header da coluna de labels */}
              <div className="h-10 border-b px-3 flex items-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Disciplina
                </span>
              </div>
              {/* Rows */}
              {rows.map((row, i) => (
                <div
                  key={i}
                  className={cn("h-14 border-b px-3 flex flex-col justify-center", row.atrasada && "bg-red-50/40")}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{row.disc.disciplina}</span>
                    {row.atrasada && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
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

            {/* Área scrollável do timeline */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto">
              <div
                className="relative"
                style={{ minWidth: zoom === "weeks" ? `${columns.length * 80}px` : `${columns.length * 120}px` }}
              >
                {/* Header com colunas (meses/semanas) */}
                <div className="h-10 border-b flex sticky top-0 bg-background z-10">
                  {columns.map((col, i) => (
                    <div key={i} className="flex-1 border-r last:border-r-0 flex items-center justify-center">
                      <span className="text-[10px] font-medium text-muted-foreground capitalize">{col.label}</span>
                    </div>
                  ))}
                </div>

                {/* Área das barras */}
                <div className="relative">
                  {/* Grid lines verticais */}
                  <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                    {columns.map((_, i) => (
                      <div key={i} className="flex-1 border-r last:border-r-0 border-dashed border-gray-100" />
                    ))}
                  </div>

                  {/* Marcador "Hoje" */}
                  {todayPct >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                      style={{ left: `${todayPct}%` }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 py-0.5 rounded-b font-bold whitespace-nowrap">
                        HOJE
                      </div>
                    </div>
                  )}

                  {/* Barras de cada disciplina */}
                  <TooltipProvider delayDuration={200}>
                    {rows.map((row, i) => (
                      <div key={i} className={cn("h-14 border-b relative", row.atrasada && "bg-red-50/20")}>
                        {row.widthPct > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "absolute top-3 h-8 rounded-md cursor-default transition-all",
                                  "flex items-center overflow-hidden",
                                  "shadow-sm border border-black/5",
                                  row.colors.bar,
                                  row.atrasada && "ring-2 ring-red-300 ring-offset-1"
                                )}
                                style={{
                                  left: `${row.leftPct}%`,
                                  width: `${row.widthPct}%`,
                                  minWidth: "24px",
                                }}
                              >
                                {/* Barra de progresso interna para "Em Andamento" */}
                                {row.status === "Em Andamento" && row.start && row.end && (
                                  <div
                                    className="absolute inset-0 bg-blue-700/30 rounded-md"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (diffDays(row.start, new Date()) / diffDays(row.start, row.end)) * 100))}%`,
                                    }}
                                  />
                                )}
                                <span className="text-[10px] text-white font-medium px-2 relative z-10 truncate">
                                  {row.disc.disciplina}
                                </span>
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
                                  <p>Início: {formatDateBR(row.disc.data_inicio)}</p>
                                  <p>Previsão: {formatDateBR(row.disc.data_previsao)}</p>
                                  {row.disc.data_final && <p>Conclusão: {formatDateBR(row.disc.data_final)}</p>}
                                </div>
                                {row.resps.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Responsáveis: {row.resps.map((r) => r.responsavel_nome).join(", ")}
                                  </p>
                                )}
                                {row.atrasada && row.disc.justificativa_atraso && (
                                  <p className="text-xs text-red-600 italic">
                                    Justificativa: {row.disc.justificativa_atraso}
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-6 rounded-sm", colors.bar)} />
            <span>{status}</span>
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
