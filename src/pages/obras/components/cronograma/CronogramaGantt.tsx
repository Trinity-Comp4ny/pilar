import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { estadoTarefaCronograma } from "@/lib/obras";
import {
  addDays,
  endOfMonth,
  generateColumns,
  parseDate,
  startOfMonth,
  toIso,
  todayPosition,
  type ZoomLevel,
} from "@/lib/cronograma";
import { achatarArvore, NIVEL_LABEL, unirPeriodos, type LinhaCronograma, type NoArvore } from "@/lib/obraArvore";
import { useGanttDrag } from "@/components/gantt/useGanttDrag";
import type { ObraFrenteRow } from "@/hooks/useObraFrentes";
import type { ObraTarefa } from "@/hooks/useObraTarefas";
import { ESTADO_FILL, ESTADO_LABEL, LEGENDA } from "./estado";
import type { CronogramaAcoes } from "./useCronogramaAcoes";

type Arvore = NoArvore<ObraFrenteRow, ObraTarefa>;
type Linha = LinhaCronograma<ObraFrenteRow, ObraTarefa>;

const ALTURA: Record<"fase" | "etapa" | "servico" | "tarefa", number> = {
  fase: 44,
  etapa: 40,
  servico: 36,
  tarefa: 32,
};
const INDENT = 14;

const intervalo = (inicio: string | null, fim: string | null) => {
  const s = parseDate(inicio);
  const e = parseDate(fim);
  return s && e ? { start: s, end: e } : null;
};

export function CronogramaGantt({
  fases,
  recolhidos,
  onToggle,
  canEdit,
  acoes,
  onIrParaLista,
}: {
  fases: Arvore[];
  recolhidos: ReadonlySet<string>;
  onToggle: (id: string) => void;
  canEdit: boolean;
  acoes: CronogramaAcoes;
  onIrParaLista: () => void;
}) {
  const isMobile = useIsMobile();
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const linhas = useMemo(() => achatarArvore(fases, recolhidos), [fases, recolhidos]);

  const { columns, tlStart, tlEnd, todayPct, colWidth } = useMemo(() => {
    const total = unirPeriodos(fases.map((f) => f.periodo));
    const ini = parseDate(total?.inicio) ?? new Date();
    const fim = parseDate(total?.fim) ?? addDays(ini, 90);
    const start = startOfMonth(ini);
    const end = endOfMonth(addDays(fim, 14));
    return {
      columns: total ? generateColumns(start, end, zoom) : [],
      tlStart: start,
      tlEnd: end,
      todayPct: todayPosition(start, end),
      colWidth: zoom === "weeks" ? 80 : 120,
    };
  }, [fases, zoom]);

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current || todayPct < 0) return;
    const c = scrollRef.current;
    c.scrollTo({ left: (todayPct / 100) * c.scrollWidth - c.clientWidth / 2, behavior: "smooth" });
  }, [todayPct]);

  useEffect(() => {
    if (todayPct >= 0) scrollToToday();
  }, [todayPct, scrollToToday]);

  const { isSaving, isDragging, startDrag, getBarGeometry, shouldSuppressClick } = useGanttDrag<string>({
    timelineStart: tlStart,
    timelineEnd: tlEnd,
    zoom,
    enabled: canEdit,
    timelineRef,
    scrollRef,
    onCommit: async (chave, { start, end }) => {
      const [tipo, id] = chave.split(":");
      if (tipo === "no") await acoes.atualizarNo({ id, data_inicio: toIso(start), data_fim: toIso(end) });
      else await acoes.atualizarTarefa({ id, data_inicio: toIso(start), prazo: toIso(end) });
    },
  });

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Sem datas para a linha do tempo"
        description="Defina início e fim de pelo menos um serviço ou tarefa na lista e a linha do tempo aparece aqui."
        action={{ label: "Ir para a lista", onClick: onIrParaLista, variant: "outline" }}
      />
    );
  }

  const alturaDe = (l: Linha) => (l.tipo === "tarefa" ? ALTURA.tarefa : ALTURA[l.arvore.nivel]);

  return (
    <div className="space-y-3" style={{ userSelect: isDragging ? "none" : undefined }}>
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <div className="flex flex-col items-start gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-ink">Linha do tempo</h3>
            {isSaving && <span className="animate-pulse text-[10px] text-muted-foreground">Salvando…</span>}
            {isDragging && <span className="text-[10px] text-muted-foreground">Esc cancela</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={scrollToToday} disabled={todayPct < 0}>
              Hoje
            </Button>
            <div className="flex items-center overflow-hidden rounded-md border">
              <Button
                variant={zoom === "months" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 rounded-none px-2 text-xs"
                onClick={() => setZoom("months")}
                aria-label="Meses"
              >
                <ZoomOut className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">Meses</span>
              </Button>
              <Button
                variant={zoom === "weeks" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 rounded-none px-2 text-xs"
                onClick={() => setZoom("weeks")}
                aria-label="Semanas"
              >
                <ZoomIn className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">Semanas</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Coluna fixa com a árvore */}
          <div className={cn("shrink-0 border-r bg-muted/30", isMobile ? "w-[132px]" : "w-[280px]")}>
            <div className="flex h-10 items-center border-b px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fase / etapa / serviço / tarefa
              </span>
            </div>
            {linhas.map((l) => (
              <div
                key={l.chave}
                className="flex items-center gap-1 border-b pr-2"
                style={{ height: alturaDe(l), paddingLeft: 4 + l.profundidade * (isMobile ? 6 : INDENT) }}
              >
                {l.tipo === "no" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggle(l.arvore.no.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                      aria-label={recolhidos.has(l.arvore.no.id) ? "Expandir" : "Recolher"}
                    >
                      {recolhidos.has(l.arvore.no.id) ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-col">
                      <span
                        className={cn(
                          "truncate text-xs text-ink",
                          l.arvore.nivel === "fase" ? "font-semibold" : l.arvore.nivel === "etapa" && "font-medium"
                        )}
                      >
                        {l.arvore.no.nome}
                      </span>
                      {!isMobile && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {NIVEL_LABEL[l.arvore.nivel]} · {ESTADO_LABEL[l.arvore.estado]}
                          {l.arvore.total > 0 && ` · ${l.arvore.progresso}%`}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Checkbox
                      checked={l.tarefa.status === "concluida"}
                      disabled={!canEdit}
                      onCheckedChange={(v) =>
                        acoes.atualizarTarefa({ id: l.tarefa.id, status: v === true ? "concluida" : "a_fazer" })
                      }
                      className="ml-1.5"
                      aria-label={`Concluir ${l.tarefa.titulo}`}
                    />
                    <span
                      className={cn(
                        "truncate text-[11px]",
                        l.tarefa.status === "concluida" ? "text-muted-foreground line-through" : "text-ink"
                      )}
                    >
                      {l.tarefa.titulo}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Linha do tempo */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto">
            <div ref={timelineRef} className="relative" style={{ minWidth: `${columns.length * colWidth}px` }}>
              <div className="relative flex h-10 border-b">
                {columns.map((col, i) => (
                  <div key={i} className="flex flex-1 items-center justify-center border-r last:border-r-0">
                    <span className="text-[10px] font-medium capitalize text-muted-foreground">{col.label}</span>
                  </div>
                ))}
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
                  {columns.map((_, i) => (
                    <div key={i} className="flex-1 border-r border-dashed border-border last:border-r-0" />
                  ))}
                </div>
                {todayPct >= 0 && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-negative"
                    style={{ left: `${todayPct}%` }}
                    aria-hidden
                  />
                )}

                {linhas.map((l) => (
                  <div key={l.chave} className="relative border-b" style={{ height: alturaDe(l) }}>
                    <Barra
                      linha={l}
                      canEdit={canEdit}
                      geometria={getBarGeometry}
                      startDrag={startDrag}
                      shouldSuppressClick={shouldSuppressClick}
                      onToggle={onToggle}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        {LEGENDA.map((estado) => (
          <div key={estado} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-6 rounded-sm", ESTADO_FILL[estado])} />
            <span>{ESTADO_LABEL[estado]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm border border-dashed border-muted-foreground/50" />
          <span>Período pelos itens abaixo</span>
        </div>
        {canEdit && <span className="text-muted-foreground/70">Arraste as bordas para ajustar as datas</span>}
      </div>
    </div>
  );
}

type Geometria = ReturnType<typeof useGanttDrag<string>>["getBarGeometry"];
type StartDrag = ReturnType<typeof useGanttDrag<string>>["startDrag"];

function Barra({
  linha,
  canEdit,
  geometria,
  startDrag,
  shouldSuppressClick,
  onToggle,
}: {
  linha: Linha;
  canEdit: boolean;
  geometria: Geometria;
  startDrag: StartDrag;
  shouldSuppressClick: () => boolean;
  onToggle: (id: string) => void;
}) {
  const tarefa = linha.tipo === "tarefa";
  const chave = tarefa ? `tarefa:${linha.tarefa.id}` : `no:${linha.arvore.no.id}`;
  const propria = tarefa
    ? intervalo(linha.tarefa.data_inicio, linha.tarefa.prazo)
    : intervalo(linha.arvore.no.data_inicio, linha.arvore.no.data_fim);
  const estado = tarefa ? estadoTarefaCronograma(linha.tarefa) : linha.arvore.estado;
  const titulo = tarefa ? linha.tarefa.titulo : linha.arvore.no.nome;

  // Sem data própria, o nó mostra a barra-resumo tracejada (não arrastável).
  if (!propria) {
    const resumo =
      !tarefa && linha.arvore.periodo ? intervalo(linha.arvore.periodo.inicio, linha.arvore.periodo.fim) : null;
    if (!resumo) {
      return (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] italic text-muted-foreground">
          sem período
        </span>
      );
    }
    const g = geometria(chave, resumo);
    if (!g) return null;
    return (
      <button
        type="button"
        onClick={() => !tarefa && onToggle(linha.arvore.no.id)}
        title={`${titulo} · período pelos itens abaixo`}
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm border border-dashed border-muted-foreground/50 bg-muted/40"
        style={{ left: `${g.leftPct}%`, width: `${g.widthPct}%`, minWidth: 8 }}
      />
    );
  }

  const g = geometria(chave, propria);
  if (!g) return null;
  const altura = tarefa ? "h-5" : linha.arvore.nivel === "fase" ? "h-7" : "h-6";
  const alca = (lado: "left" | "right") =>
    canEdit && (
      <div
        className={cn(
          "absolute bottom-0 top-0 z-10 w-3 cursor-col-resize hover:bg-black/20",
          lado === "left" ? "left-0 rounded-l" : "right-0 rounded-r"
        )}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startDrag(e.clientX, chave, lado, propria);
        }}
        aria-hidden
      />
    );

  return (
    <div
      className={cn(
        "absolute top-1/2 flex -translate-y-1/2 items-center rounded border border-black/5 shadow-sm",
        altura,
        ESTADO_FILL[estado]
      )}
      style={{ left: `${g.leftPct}%`, width: `${g.widthPct}%`, minWidth: 24 }}
    >
      {alca("left")}
      <button
        type="button"
        onClick={() => {
          if (shouldSuppressClick()) return;
          if (!tarefa) onToggle(linha.arvore.no.id);
        }}
        onMouseDown={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          e.stopPropagation();
          startDrag(e.clientX, chave, "move", propria);
        }}
        title={`${titulo} · ${ESTADO_LABEL[estado]}`}
        className={cn(
          "flex flex-1 items-center overflow-hidden px-2",
          canEdit && "mx-2 cursor-grab active:cursor-grabbing"
        )}
      >
        <span className="truncate text-[10px] font-medium text-white">
          {!tarefa && linha.arvore.total > 0 ? `${linha.arvore.progresso}%` : titulo}
        </span>
      </button>
      {alca("right")}
    </div>
  );
}
