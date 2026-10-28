import { useEffect, useMemo, useRef, useState } from "react";
import { ZoomSwitcher } from "@/components/gantt/ZoomSwitcher";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronDown, Layers, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { cn } from "@/lib/utils";
import { type Projeto, getDeadlineStatus, isDiscAtrasada } from "@/types/projetos";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";
import {
  addDays,
  diffDays,
  endOfMonth,
  generateColumns,
  parseDate,
  startOfMonth,
  textoSobreBarra,
  toIso,
  type GanttDragType,
  type ZoomLevel,
} from "@/lib/cronograma";
import { useGanttDrag } from "@/components/gantt/useGanttDrag";
import { DisciplinaTimelineRows } from "./CronogramaDisciplinaRows";
import { CronogramaColunaProjetos } from "./CronogramaColunaProjetos";
import { CronogramaMeusToggle, useFiltroMeusProjetos } from "./CronogramaMeusToggle";
import { useMinhaPessoa } from "@/hooks/useMinhaPessoa";
import { useReordenarProjetos } from "@/pages/projetos/hooks/useReordenarProjetos";
import {
  compararPorPrioridade,
  idsParaGravar,
  moverNaLista,
  projetoTemDisciplinaDaPessoa,
} from "@/pages/projetos/lib/ordemPrioridade";

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
          <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
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
  /** Quem edita projetos arrasta a alça para mudar a ordem de prioridade (SPEC 143). */
  canReorder?: boolean;
}

const STATUS_BAR_COLORS: Record<string, string> = {
  [PROJECT_STATUS.PLANEJAMENTO]: "bg-status-planning",
  [PROJECT_STATUS.EM_ANDAMENTO]: "bg-status-progress",
  [PROJECT_STATUS.REVISAO]: "bg-status-review",
  [PROJECT_STATUS.PARALISADO]: "bg-brand",
  [PROJECT_STATUS.CONCLUIDO]: "bg-positive",
  [PROJECT_STATUS.CANCELADO]: "bg-status-cancelled",
};

function formatDateBR(d: string | undefined | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("pt-BR");
}

export function CronogramaProjetosTab({ projetos, onDatesChange, canReorder = false }: CronogramaProjetosTabProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [responsavelFilter, setResponsavelFilter] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [outrasAbertas, setOutrasAbertas] = useState<Set<string>>(new Set());
  const [meus, setMeus] = useFiltroMeusProjetos();
  const { data: minhaPessoa, isPending: carregandoPessoa } = useMinhaPessoa();
  const reordenarMut = useReordenarProjetos();
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
        if (meus && !(minhaPessoa && projetoTemDisciplinaDaPessoa(p, minhaPessoa.id))) return false;
        return parseDate(p.data_inicio) && parseDate(p.data_previsao);
      })
      .sort(compararPorPrioridade);
  }, [projetos, statusFilter, clienteFilter, responsavelFilter, meus, minhaPessoa]);

  // A alça só aparece sem filtro ativo: reordenar uma lista filtrada renumeraria só uma parte dos projetos.
  const semFiltro = statusFilter === "all" && clienteFilter.length === 0 && responsavelFilter.length === 0 && !meus;
  const podeReordenar = canReorder && !isMobile && semFiltro && !reordenarMut.isPending;
  const reordenar = (de: number, para: number) => {
    const novaOrdem = moverNaLista(visibleProjetos, de, para);
    if (novaOrdem !== visibleProjetos) reordenarMut.mutate(idsParaGravar(novaOrdem, projetos));
  };

  const pessoaDoFiltro = meus ? minhaPessoa?.id : undefined;

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
      const barClass = STATUS_BAR_COLORS[p.status] || "bg-status-unknown";
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

  // Em "Meus projetos" as disciplinas da pessoa já vêm abertas; o clique no chevron recolhe.
  const estaExpandido = (projetoId: string) => (meus ? !expandedIds.has(projetoId) : expandedIds.has(projetoId));
  const toggleOutras = (projetoId: string) =>
    setOutrasAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(projetoId)) next.delete(projetoId);
      else next.add(projetoId);
      return next;
    });

  const toggleExpandDisciplinas = (projetoId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projetoId)) {
        next.delete(projetoId);
      } else {
        next.add(projetoId);
      }
      return next;
    });
  };

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

  const {
    override: dragOverride,
    guideX,
    isSaving,
    isDragging,
    startDrag,
    getBarGeometry,
    guideDateLabel,
    shouldSuppressClick,
  } = useGanttDrag<string>({
    timelineStart,
    timelineEnd,
    zoom,
    enabled: !!onDatesChange,
    timelineRef,
    scrollRef,
    onCommit: async (projetoId, { start, end }) => {
      if (!onDatesChange) return;
      await onDatesChange(projetoId, { data_inicio: toIso(start), data_previsao: toIso(end) });
    },
  });

  const getDragLabel = (geo: { start: Date; end: Date }, type: GanttDragType): string => {
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
        <CardContent className="p-0">
          <EmptyState
            icon={Layers}
            title="Nenhum projeto cadastrado"
            description="Os projetos aparecem no cronograma assim que forem criados."
          />
        </CardContent>
      </Card>
    );
  }

  const projetosSemDatas = projetos.filter((p) => !parseDate(p.data_inicio) || !parseDate(p.data_previsao));

  return (
    <div className="space-y-4" style={{ userSelect: isDragging ? "none" : undefined }}>
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Title + zoom controls: título e controles empilham em mobile
                (achado da auditoria: "Cronograma de Projetos" + "Hoje" +
                "Meses"/"Semanas" não cabiam em 390px sem quebrar linha nem
                truncar, e o excesso vazava em vez de ficar contido). */}
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h3 className="truncate text-sm font-semibold">Cronograma de Projetos</h3>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {visibleProjetos.length} projeto{visibleProjetos.length === 1 ? "" : "s"}
                </span>
                {isSaving && <span className="text-[10px] text-muted-foreground animate-pulse">Salvando...</span>}
                {isDragging && (
                  <span className="text-[10px] text-muted-foreground/60 border border-dashed border-muted-foreground/30 rounded px-1.5 py-0.5">
                    Esc para cancelar
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={scrollToToday}
                  disabled={todayPct < 0}
                >
                  Hoje
                </Button>
                <ZoomSwitcher value={zoom} onChange={setZoom} />
              </div>
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-2 flex-wrap">
              <CronogramaMeusToggle value={meus} onChange={setMeus} />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProjectStatus | "all")}>
                <SelectTrigger className="h-7 text-xs w-[160px]" aria-label="Filtrar por status">
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-soft border border-warning-mid-border text-warning-strong text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {projetosSemDatas.length} projeto{projetosSemDatas.length > 1 ? "s" : ""} sem data de início ou previsão:{" "}
            {projetosSemDatas
              .slice(0, 3)
              .map((p) => p.nome)
              .join(", ")}
            {projetosSemDatas.length > 3 ? ` e mais ${projetosSemDatas.length - 3}` : ""}
          </span>
        </div>
      )}

      {meus && carregandoPessoa ? (
        <PageLoader size="section" label="Carregando seus projetos" />
      ) : visibleProjetos.length === 0 && meus ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Layers}
              title="Nenhum projeto com disciplina sua"
              description="Peça ao coordenador para atribuir você a uma disciplina."
              action={{ label: "Ver todos os projetos", variant: "outline", onClick: () => setMeus(false) }}
            />
          </CardContent>
        </Card>
      ) : visibleProjetos.length === 0 ? (
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
            <div className="flex items-start max-h-[calc(100svh-420px)] overflow-y-auto">
              <CronogramaColunaProjetos
                rows={rows}
                isMobile={isMobile}
                isExpanded={estaExpandido}
                onToggleExpand={toggleExpandDisciplinas}
                onOpen={(id) => navigate(`/projetos/${id}#cronograma`)}
                podeReordenar={podeReordenar}
                onReordenar={reordenar}
                pessoaId={pessoaDoFiltro}
                outrasAbertas={outrasAbertas}
                onToggleOutras={toggleOutras}
              />

              {/* Scrollable timeline */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Linha do tempo dos projetos (role com as setas do teclado)"
              >
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
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-fill-danger text-fill-danger-foreground text-[9px] px-1.5 py-0.5 font-bold whitespace-nowrap rounded-t-sm z-10">
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
                        <div key={i} className="flex-1 border-r last:border-r-0 border-dashed border-border" />
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
                      {rows.map((row) => {
                        const cfg = PROJECT_STATUS_CONFIG[row.projeto.status];
                        const base = { start: row.start, end: row.end };
                        const geo = getBarGeometry(row.projeto.id, base);
                        const isThisDragging = dragOverride?.key === row.projeto.id;
                        const canDrag = !!onDatesChange && !!geo;
                        const isExpanded = estaExpandido(row.projeto.id);

                        if (!geo) {
                          return (
                            <div key={row.projeto.id}>
                              <div className="h-14 border-b relative" />
                              {isExpanded && (
                                <DisciplinaTimelineRows
                                  projetoId={row.projeto.id}
                                  timelineStart={timelineStart}
                                  timelineEnd={timelineEnd}
                                  onNavigate={() => navigate(`/projetos/${row.projeto.id}#cronograma`)}
                                  pessoaId={pessoaDoFiltro}
                                  mostrarOutras={outrasAbertas.has(row.projeto.id)}
                                />
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={row.projeto.id}>
                            <div className={cn("h-14 border-b relative", row.atrasado && "bg-danger-soft/20")}>
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
                                          startDrag(e.clientX, row.projeto.id, "left", base);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          startDrag(e.touches[0].clientX, row.projeto.id, "left", base);
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
                                              startDrag(e.clientX, row.projeto.id, "move", base);
                                            }
                                          : undefined
                                      }
                                      onTouchStart={
                                        canDrag
                                          ? (e) => startDrag(e.touches[0].clientX, row.projeto.id, "move", base)
                                          : undefined
                                      }
                                      onClick={() => {
                                        if (shouldSuppressClick()) return;
                                        navigate(`/projetos/${row.projeto.id}#cronograma`);
                                      }}
                                    >
                                      <span
                                        className={cn(
                                          "text-[10px] font-medium truncate",
                                          textoSobreBarra(row.barClass)
                                        )}
                                      >
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
                                          startDrag(e.clientX, row.projeto.id, "right", base);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          startDrag(e.touches[0].clientX, row.projeto.id, "right", base);
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
                                      {row.projeto.cliente_nome && <p>Cliente: {row.projeto.cliente_nome}</p>}
                                      <p>Início: {formatDateBR(geo.start)}</p>
                                      <p>Previsão: {formatDateBR(geo.end)}</p>
                                      {row.projeto.data_final && (
                                        <p>Conclusão: {formatDateBR(row.projeto.data_final)}</p>
                                      )}
                                      <p className="text-muted-foreground/60">
                                        Duração: {diffDays(geo.start, geo.end)} dias
                                      </p>
                                      {row.totalDiscs > 0 && (
                                        <p>
                                          {row.totalDiscs} disciplina{row.totalDiscs === 1 ? "" : "s"}
                                          {row.discAtrasadas > 0 && (
                                            <span className="text-danger-mid ml-1">
                                              · {row.discAtrasadas} atrasada{row.discAtrasadas === 1 ? "" : "s"}
                                            </span>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60 border-t pt-1 mt-1">
                                      {canDrag
                                        ? "Arraste as bordas para ajustar as datas"
                                        : "Clique para abrir o cronograma"}
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
                            {isExpanded && (
                              <DisciplinaTimelineRows
                                projetoId={row.projeto.id}
                                timelineStart={timelineStart}
                                timelineEnd={timelineEnd}
                                onNavigate={() => navigate(`/projetos/${row.projeto.id}#cronograma`)}
                                pessoaId={pessoaDoFiltro}
                                mostrarOutras={outrasAbertas.has(row.projeto.id)}
                              />
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
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>↔</span>
            <span>Arraste as bordas para ajustar datas</span>
          </div>
        )}
      </div>
    </div>
  );
}
