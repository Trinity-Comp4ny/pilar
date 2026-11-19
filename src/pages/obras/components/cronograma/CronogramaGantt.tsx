import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ZoomSwitcher } from "@/components/gantt/ZoomSwitcher";
import { CalendarClock, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLarguraDoElemento } from "@/pages/obras/hooks/useLarguraDoElemento";
import { cn } from "@/lib/utils";
import { estadoTarefaCronograma } from "@/lib/obras";
import {
  LARGURA_MINIMA_MES_CELULAR_PX,
  addDays,
  endOfMonth,
  generateColumns,
  parseDate,
  passoDosRotulos,
  rotuloCurtoDoMes,
  startOfMonth,
  toIso,
  todayPosition,
  type ZoomLevel,
} from "@/lib/cronograma";
import {
  achatarArvore,
  NIVEL_LABEL,
  unirPeriodos,
  type LinhaCronograma,
  type NoArvore,
} from "@/pages/obras/lib/obraArvore";
import { GANTT_LABEL_W, GANTT_FRAME } from "@/components/gantt/ganttStyle";
import { useGanttDrag } from "@/components/gantt/useGanttDrag";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { baixarCsv, cronogramaParaCsv } from "@/pages/obras/lib/cronogramaCsv";
import { desembolsoPorColuna } from "@/pages/obras/lib/custoPorPeriodo";
import type { FisicoFinanceiro } from "@/pages/obras/lib/fisicoFinanceiro";
import { achatarOrcado, type LinhaOrcado, type OrcadoRealizado } from "@/lib/orcadoRealizado";
import type { ObraFrenteRow } from "@/pages/obras/hooks/useObraFrentes";
import type { ObraTarefa } from "@/pages/obras/hooks/useObraTarefas";
import { ESTADO_BARRA, ESTADO_LABEL, NIVEL_COR, NIVEL_NOME, type NivelCor } from "./estado";
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
  orcado,
  fisicoFinanceiro,
  despesas,
  nomeArquivo = "cronograma-obra",
}: {
  fases: Arvore[];
  recolhidos: ReadonlySet<string>;
  onToggle: (id: string) => void;
  canEdit: boolean;
  acoes: CronogramaAcoes;
  onIrParaLista: () => void;
  /** Orçado e realizado por item (só para quem vê o financeiro): liga o custo ao cronograma. */
  orcado?: OrcadoRealizado | null;
  /** Físico-financeiro da obra (spec 165): a mesma conta da grade da aba Financeiro, com o ajuste manual. */
  fisicoFinanceiro?: FisicoFinanceiro | null;
  /** Despesas da obra, para o gasto por período. */
  despesas?: ReadonlyArray<{ data: string; valor: number }>;
  /** Nome do CSV exportado (sem extensão). */
  nomeArquivo?: string;
}) {
  const formatCurrency = useMoneyMask();
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
      // No celular, em meses, a obra inteira cabe na tela (o mês encolhe até o mínimo); semanas seguem rolando.
      colWidth: zoom === "weeks" ? 80 : isMobile ? LARGURA_MINIMA_MES_CELULAR_PX : 120,
    };
  }, [fases, zoom, isMobile]);
  // Custo por item (para a linha da árvore) e por coluna (para a faixa de desembolso).
  const custoDoNo = useMemo(() => {
    const m = new Map<string, LinhaOrcado>();
    if (orcado) achatarOrcado(orcado.raizes).forEach((l) => m.set(l.no.id, l));
    return m;
  }, [orcado]);
  const custoColunas = useMemo(
    () =>
      fisicoFinanceiro
        ? desembolsoPorColuna(
            fisicoFinanceiro,
            despesas ?? [],
            columns.map((c) => ({ inicio: toIso(c.start), fim: toIso(c.end) }))
          )
        : null,
    [fisicoFinanceiro, despesas, columns]
  );
  const larguraDaLinhaDoTempo = useLarguraDoElemento(scrollRef);
  const reguaCurta = isMobile && zoom === "months";
  const passo = reguaCurta
    ? passoDosRotulos(Math.max(colWidth, larguraDaLinhaDoTempo / Math.max(1, columns.length)))
    : 1;

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current || todayPct < 0) return;
    const c = scrollRef.current;
    c.scrollTo({ left: (todayPct / 100) * c.scrollWidth - c.clientWidth / 2, behavior: "smooth" });
  }, [todayPct]);

  useEffect(() => {
    if (todayPct >= 0) scrollToToday();
  }, [todayPct, scrollToToday]);

  // Quem contém quem: a faixa do pai (para desenhar) e o período que cada nó precisa cobrir (para travar).
  const { faixaDoPai, limitesDe } = useMemo(() => {
    const faixa = new Map<string, { start: Date; end: Date; nome: string; nivel: string } | null>();
    const limites = new Map<
      string,
      {
        pai: { start: Date; end: Date; nome: string; nivel: string } | null;
        cobrir: { inicio: string; fim: string } | null;
      }
    >();
    const visitar = (a: Arvore, pai: Arvore | null) => {
      const paiPeriodo = pai?.periodoProprio ? intervalo(pai.periodoProprio.inicio, pai.periodoProprio.fim) : null;
      const info = pai && paiPeriodo ? { ...paiPeriodo, nome: pai.no.nome, nivel: pai.nivel } : null;
      faixa.set(`no:${a.no.id}`, info);
      limites.set(`no:${a.no.id}`, {
        pai:
          pai && pai.periodoProprio
            ? { ...intervalo(pai.periodoProprio.inicio, pai.periodoProprio.fim)!, nome: pai.no.nome, nivel: pai.nivel }
            : null,
        cobrir: unirPeriodos([
          ...a.filhos.map((f) => f.periodo),
          ...a.tarefas.map((t) => (t.data_inicio && t.prazo ? { inicio: t.data_inicio, fim: t.prazo } : null)),
        ]),
      });
      for (const t of a.tarefas) {
        faixa.set(
          `tarefa:${t.id}`,
          a.periodoProprio
            ? { ...intervalo(a.periodoProprio.inicio, a.periodoProprio.fim)!, nome: a.no.nome, nivel: a.nivel }
            : null
        );
        limites.set(`tarefa:${t.id}`, {
          pai: a.periodoProprio
            ? { ...intervalo(a.periodoProprio.inicio, a.periodoProprio.fim)!, nome: a.no.nome, nivel: a.nivel }
            : null,
          cobrir: null,
        });
      }
      a.filhos.forEach((f) => visitar(f, a));
    };
    fases.forEach((f) => visitar(f, null));
    return { faixaDoPai: faixa, limitesDe: limites };
  }, [fases]);

  const { isSaving, isDragging, startDrag, getBarGeometry, shouldSuppressClick } = useGanttDrag<string>({
    timelineStart: tlStart,
    timelineEnd: tlEnd,
    zoom,
    enabled: canEdit,
    timelineRef,
    scrollRef,
    onCommit: async (chave, intervaloNovo) => {
      let { start, end } = intervaloNovo;
      const lim = limitesDe.get(chave);
      // O filho fica dentro do pai: fora do período dele, a barra volta para a borda.
      if (lim?.pai && (start < lim.pai.start || end > lim.pai.end)) {
        const antes = `${toIso(start)} a ${toIso(end)}`;
        start = start < lim.pai.start ? lim.pai.start : start;
        end = end > lim.pai.end ? lim.pai.end : end;
        if (start > end) start = end;
        toast.info(
          `Fica dentro d${lim.pai.nivel === "fase" ? "a" : "o"} ${NIVEL_NOME[lim.pai.nivel as NivelCor].toLowerCase()}`,
          {
            description: `"${lim.pai.nome}" vai de ${toIso(lim.pai.start)} a ${toIso(lim.pai.end)}. Ajustei (${antes}).`,
          }
        );
      }
      // O pai cobre os filhos: não dá para encolher a fase deixando uma etapa de fora.
      if (lim?.cobrir) {
        const ini = parseDate(lim.cobrir.inicio)!;
        const fim = parseDate(lim.cobrir.fim)!;
        if (start > ini || end < fim) {
          start = start > ini ? ini : start;
          end = end < fim ? fim : end;
          toast.info("Cobre o que está dentro", {
            description: `Os itens abaixo vão de ${lim.cobrir.inicio} a ${lim.cobrir.fim}. Mova-os antes de encolher.`,
          });
        }
      }
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
      <div className={GANTT_FRAME}>
        <div className="flex flex-col items-start gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-ink">Linha do tempo</h3>
            {isSaving && <span className="animate-pulse text-3xs text-muted-foreground">Salvando…</span>}
            {isDragging && <span className="text-3xs text-muted-foreground">Esc cancela</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => baixarCsv(cronogramaParaCsv(fases), nomeArquivo)}
              disabled={fases.length === 0}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={scrollToToday} disabled={todayPct < 0}>
              Hoje
            </Button>
            <ZoomSwitcher value={zoom} onChange={setZoom} />
          </div>
        </div>

        <div className="flex">
          {/* Coluna fixa com a árvore */}
          <div className={cn("shrink-0 border-r bg-muted/30", GANTT_LABEL_W)}>
            <div className="flex h-10 items-center border-b px-3">
              <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">Item</span>
            </div>
            {linhas.map((l) => (
              <div
                key={l.chave}
                className="flex items-center gap-1 border-b border-l-4 pr-2"
                style={{
                  height: alturaDe(l),
                  paddingLeft: 4 + l.profundidade * (isMobile ? 6 : INDENT),
                  borderLeftColor: NIVEL_COR[l.tipo === "tarefa" ? "tarefa" : l.arvore.nivel],
                }}
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
                        <span className="truncate text-3xs text-muted-foreground">
                          {/* Com custo, a linha troca nível e % (a cor e a barra já dizem) por orçado e gasto. */}
                          {(custoDoNo.get(l.arvore.no.id)?.previsto ?? 0) > 0 ? (
                            <>
                              {ESTADO_LABEL[l.arvore.estado]} ·{" "}
                              {formatCurrency(custoDoNo.get(l.arvore.no.id)!.previsto, { compact: true })} orçado ·{" "}
                              {formatCurrency(custoDoNo.get(l.arvore.no.id)!.realizado, { compact: true })} gasto
                            </>
                          ) : (
                            <>
                              {NIVEL_LABEL[l.arvore.nivel]} · {ESTADO_LABEL[l.arvore.estado]}
                              {l.arvore.total > 0 && ` · ${l.arvore.progresso}%`}
                            </>
                          )}
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
                        "truncate text-2xs",
                        l.tarefa.status === "concluida" ? "text-muted-foreground line-through" : "text-ink"
                      )}
                    >
                      {l.tarefa.titulo}
                    </span>
                  </>
                )}
              </div>
            ))}
            {custoColunas && (
              <>
                <div className="flex h-8 items-center border-b border-t-2 px-3 text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Previsto no período
                </div>
                <div className="flex h-8 items-center border-b px-3 text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Gasto no período
                </div>
              </>
            )}
          </div>

          {/* Linha do tempo */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto">
            <div ref={timelineRef} className="relative" style={{ minWidth: `${columns.length * colWidth}px` }}>
              <div className="relative flex h-10 border-b">
                {columns.map((col, i) =>
                  reguaCurta ? (
                    <div key={i} className={cn("relative flex-1", i % passo === 0 && "border-l first:border-l-0")}>
                      {i % passo === 0 && i + passo <= columns.length && (
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 whitespace-nowrap text-3xs font-medium text-muted-foreground">
                          {rotuloCurtoDoMes(col.start)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div key={i} className="flex flex-1 items-center justify-center border-r last:border-r-0">
                      <span className="text-3xs font-medium capitalize text-muted-foreground">{col.label}</span>
                    </div>
                  )
                )}
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
                  {columns.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 border-dashed border-border",
                        reguaCurta ? i % passo === 0 && i > 0 && "border-l" : "border-r last:border-r-0"
                      )}
                    />
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
                    <FaixaDoPai
                      faixa={
                        faixaDoPai.get(l.tipo === "tarefa" ? `tarefa:${l.tarefa.id}` : `no:${l.arvore.no.id}`) ?? null
                      }
                      geometria={getBarGeometry}
                    />
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
                {custoColunas && (
                  <>
                    <div className="relative flex h-8 border-b border-t-2">
                      {custoColunas.previsto.map((v, i) => (
                        <div
                          key={i}
                          className="flex flex-1 items-center justify-center px-0.5 text-3xs tabular-nums text-muted-foreground"
                          title={v > 0 ? formatCurrency(v) : undefined}
                        >
                          {v > 0 ? formatCurrency(v, { compact: true }) : ""}
                        </div>
                      ))}
                    </div>
                    <div className="relative flex h-8 border-b">
                      {custoColunas.realizado.map((v, i) => (
                        <div
                          key={i}
                          className="flex flex-1 items-center justify-center px-0.5 text-3xs font-medium tabular-nums text-ink"
                          title={v > 0 ? formatCurrency(v) : undefined}
                        >
                          {v > 0 ? formatCurrency(v, { compact: true }) : ""}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {custoColunas && (custoColunas.previstoSemData > 0 || custoColunas.realizadoForaDaLinha > 0) && (
        <p className="text-center text-xs text-muted-foreground">
          {custoColunas.previstoSemData > 0 &&
            `${formatCurrency(custoColunas.previstoSemData)} do orçado está em itens sem período e não entra na faixa. `}
          {custoColunas.realizadoForaDaLinha > 0 &&
            `${formatCurrency(custoColunas.realizadoForaDaLinha)} de despesas têm data fora da linha do tempo.`}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        {(Object.keys(NIVEL_NOME) as NivelCor[]).map((nivel) => (
          <div key={nivel} className="flex items-center gap-1.5">
            <div className="h-2.5 w-6 rounded-sm" style={{ backgroundColor: NIVEL_COR[nivel] }} />
            <span>{NIVEL_NOME[nivel]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm bg-muted-foreground/40 ring-2 ring-negative ring-offset-1" />
          <span>Atrasada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm bg-muted-foreground/40 opacity-60" />
          <span>Concluída</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm border border-dashed border-muted-foreground/50" />
          <span>Período pelos itens abaixo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 border-x border-dashed border-black/15 bg-black/[0.06]" />
          <span>Período do item pai (não passa dele)</span>
        </div>
        {canEdit && <span className="text-muted-foreground/70">Arraste as bordas para ajustar as datas</span>}
      </div>
    </div>
  );
}

/** Sombra do período do pai atrás do filho: mostra de onde a barra não pode sair. */
function FaixaDoPai({
  faixa,
  geometria,
}: {
  faixa: { start: Date; end: Date; nome: string; nivel: string } | null;
  geometria: Geometria;
}) {
  if (!faixa) return null;
  const g = geometria(`faixa:${faixa.nome}:${faixa.start.getTime()}`, { start: faixa.start, end: faixa.end });
  if (!g) return null;
  return (
    <div
      aria-hidden
      title={`${NIVEL_NOME[faixa.nivel as NivelCor]} ${faixa.nome}`}
      className="pointer-events-none absolute inset-y-0 border-x border-dashed border-black/15 bg-black/[0.04]"
      style={{ left: `${g.leftPct}%`, width: `${g.widthPct}%` }}
    />
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
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-3xs italic text-muted-foreground">
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
        ESTADO_BARRA[estado]
      )}
      style={{
        left: `${g.leftPct}%`,
        width: `${g.widthPct}%`,
        minWidth: 24,
        backgroundColor: NIVEL_COR[tarefa ? "tarefa" : linha.arvore.nivel],
      }}
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
        <span className="truncate text-3xs font-medium text-white">
          {!tarefa && linha.arvore.total > 0 ? `${linha.arvore.progresso}%` : titulo}
        </span>
      </button>
      {alca("right")}
    </div>
  );
}
