import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Circle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DisciplinaResponsavel, getDiscDeadlineStatus } from "@/types/projetos";
import { formatDateShort } from "@/lib/dateUtils";
import type { ChecklistCounts } from "@/hooks/useProjetoDisciplinaChecklist";

type DiscStatusVisual = "concluido" | "em_andamento" | "atrasado" | "nao_iniciado";

function getDiscStatusVisual(disc: DisciplinaResponsavel): DiscStatusVisual {
  if (disc.status === "Concluído") return "concluido";
  const deadline = getDiscDeadlineStatus(disc);
  if (deadline?.status_data === "em_atraso") return "atrasado";
  if (disc.status === "Em Andamento") return "em_andamento";
  return "nao_iniciado";
}

const STATUS_VISUAL_CONFIG: Record<
  DiscStatusVisual,
  { dotClass: string; icon: typeof CheckCircle2; iconClass: string; label: string; pulse?: boolean }
> = {
  concluido: { dotClass: "bg-status-done", icon: CheckCircle2, iconClass: "text-white", label: "Concluído" },
  em_andamento: {
    dotClass: "bg-status-progress",
    icon: Clock,
    iconClass: "text-white",
    label: "Em andamento",
    pulse: true,
  },
  atrasado: { dotClass: "bg-status-cancelled", icon: AlertTriangle, iconClass: "text-white", label: "Atrasado" },
  nao_iniciado: {
    dotClass: "bg-white border-2 border-status-unknown",
    icon: Circle,
    iconClass: "text-status-unknown",
    label: "Não iniciado",
  },
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

interface ConnectorPath {
  d: string;
  length: number;
}

/** Mede as caixas de etapa (via ref) e calcula um path bezier entre cada par consecutivo. */
function useEtapaConnectors(stageCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [paths, setPaths] = useState<ConnectorPath[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const boxes = stageRefs.current.slice(0, stageCount).map((el) => el?.getBoundingClientRect());
      const next: ConnectorPath[] = [];

      for (let i = 0; i < boxes.length - 1; i++) {
        const a = boxes[i];
        const b = boxes[i + 1];
        if (!a || !b) continue;

        const x1 = a.right - containerRect.left;
        const y1 = a.top + a.height / 2 - containerRect.top;
        const x2 = b.left - containerRect.left;
        const y2 = b.top + b.height / 2 - containerRect.top;
        const mx = (x1 + x2) / 2;

        next.push({
          d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
          length: Math.abs(x2 - x1) + Math.abs(y2 - y1),
        });
      }

      setPaths(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [stageCount]);

  return { containerRef, stageRefs, paths };
}

interface FluxoPipelineProps {
  disciplinas: DisciplinaResponsavel[];
  onOpenDisciplina?: (disc: DisciplinaResponsavel) => void;
  /** Chave = projeto_disciplina.id. Ausente = disciplina sem checklist (sem badge). */
  checklistCounts?: Record<string, ChecklistCounts>;
}

export function FluxoPipeline({ disciplinas, onOpenDisciplina, checklistCounts }: FluxoPipelineProps) {
  const etapas = useMemo(() => groupByEtapa(disciplinas).filter((e) => e.etapa != null), [disciplinas]);
  const reducedMotion = usePrefersReducedMotion();
  const { containerRef, stageRefs, paths } = useEtapaConnectors(etapas.length);
  const [drawn, setDrawn] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setDrawn(true);
      return;
    }
    setDrawn(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(raf);
    // Redesenha quando o número de conectores muda (etapas adicionadas/removidas).
  }, [paths.length, reducedMotion]);

  if (etapas.length === 0) return null;

  const totalDiscs = disciplinas.filter((d) => d.etapa != null).length;
  const concluidas = disciplinas.filter((d) => d.etapa != null && getDiscStatusVisual(d) === "concluido").length;
  const progresso = totalDiscs > 0 ? Math.round((concluidas / totalDiscs) * 100) : 0;

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Fluxo de Disciplinas</span>
        <span className="text-xs text-muted-foreground">
          {concluidas}/{totalDiscs} disciplinas concluídas ({progresso}%)
        </span>
      </div>

      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative flex items-stretch gap-14 py-1 min-w-max">
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="none"
                className="stroke-border"
                strokeWidth={2}
                strokeDasharray={p.length}
                strokeDashoffset={drawn ? 0 : p.length}
                style={reducedMotion ? undefined : { transition: `stroke-dashoffset 700ms ${i * 90}ms ease-out` }}
              />
            ))}
          </svg>

          {etapas.map((etapa, i) => (
            <div
              key={etapa.etapa ?? i}
              ref={(el) => {
                stageRefs.current[i] = el;
              }}
              className={cn(
                "relative z-[1] w-60 flex-shrink-0 rounded-lg border bg-white shadow-sm overflow-hidden",
                !reducedMotion && "animate-fade-up"
              )}
              style={!reducedMotion ? { animationDelay: `${i * 90}ms` } : undefined}
            >
              <div className="px-3 py-2 border-b bg-muted/40">
                <span className="text-xs font-semibold text-info-strong">{etapa.nome}</span>
              </div>
              <div>
                {etapa.disciplinas.map((disc, di) => {
                  const visual = getDiscStatusVisual(disc);
                  const config = STATUS_VISUAL_CONFIG[visual];
                  const Icon = config.icon;
                  const counts = disc.id ? checklistCounts?.[disc.id] : undefined;
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => onOpenDisciplina?.(disc)}
                      className="w-full flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/40 transition-colors text-left"
                    >
                      <span
                        className={cn(
                          "relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                          config.dotClass
                        )}
                      >
                        <Icon className={cn("h-3 w-3", config.iconClass)} />
                        {config.pulse && !reducedMotion && (
                          <span className="absolute inset-0 rounded-full bg-status-progress animate-ping opacity-60" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium truncate">{disc.disciplina}</span>
                        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {disc.responsavel_nome && (
                            <span className="flex items-center gap-0.5 truncate">
                              <User className="h-2.5 w-2.5" /> {disc.responsavel_nome}
                            </span>
                          )}
                          {disc.data_previsao && <span>{formatDateShort(disc.data_previsao)}</span>}
                          {counts && counts.total > 0 && (
                            <span className="flex-shrink-0">
                              {counts.concluidos}/{counts.total}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function groupByEtapa(disciplinas: DisciplinaResponsavel[]) {
  const groups: { etapa: number | null; nome: string; disciplinas: DisciplinaResponsavel[] }[] = [];
  const etapaMap = new Map<number, DisciplinaResponsavel[]>();
  const semEtapa: DisciplinaResponsavel[] = [];

  for (const d of disciplinas) {
    if (d.etapa != null) {
      if (!etapaMap.has(d.etapa)) etapaMap.set(d.etapa, []);
      etapaMap.get(d.etapa)!.push(d);
    } else {
      semEtapa.push(d);
    }
  }

  for (const [etapa, discs] of Array.from(etapaMap.entries()).sort(([a], [b]) => a - b)) {
    groups.push({ etapa, nome: `Etapa ${etapa}`, disciplinas: discs });
  }

  if (semEtapa.length > 0) {
    groups.push({ etapa: null, nome: "Avulsas", disciplinas: semEtapa });
  }

  return groups;
}
