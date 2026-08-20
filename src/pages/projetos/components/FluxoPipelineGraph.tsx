import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Circle, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type FluxoNodeStatus = "concluido" | "em_andamento" | "atrasado" | "nao_iniciado";

export interface FluxoPipelineNode {
  key: string;
  titulo: string;
  status: FluxoNodeStatus;
  responsavelNome?: string;
  /** Texto livre ao lado do responsável: data prevista (grafo real) ou ausente (template). */
  metaLabel?: string;
  /** Texto livre do badge de checklist: "2/5" (real) ou "5 itens" (template). Ausente = sem badge. */
  checklistLabel?: string;
}

export interface FluxoPipelineStage {
  key: string;
  titulo: string;
  /** Ex.: "5 dias úteis". Só o editor de template usa isso hoje. */
  subtitulo?: string;
  nodes: FluxoPipelineNode[];
}

const STATUS_VISUAL_CONFIG: Record<
  FluxoNodeStatus,
  { dotClass: string; icon: typeof CheckCircle2; iconClass: string; pulse?: boolean }
> = {
  concluido: { dotClass: "bg-status-done", icon: CheckCircle2, iconClass: "text-white" },
  em_andamento: { dotClass: "bg-status-progress", icon: Clock, iconClass: "text-white", pulse: true },
  atrasado: { dotClass: "bg-status-cancelled", icon: AlertTriangle, iconClass: "text-white" },
  nao_iniciado: {
    dotClass: "bg-white border-2 border-status-unknown",
    icon: Circle,
    iconClass: "text-status-unknown",
  },
};

export function usePrefersReducedMotion(): boolean {
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

interface FluxoPipelineGraphProps {
  stages: FluxoPipelineStage[];
  onNodeClick?: (nodeKey: string) => void;
  className?: string;
}

/**
 * Grafo puro (colunas conectadas por SVG, estilo pipeline de CI). Não sabe nada de
 * disciplina/projeto real nem de template de fluxo: só recebe `stages` genéricos.
 * Reusado tanto pelo grafo real (FluxoPipeline) quanto pela prévia do editor.
 */
export function FluxoPipelineGraph({ stages, onNodeClick, className }: FluxoPipelineGraphProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { containerRef, stageRefs, paths } = useEtapaConnectors(stages.length);
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

  if (stages.length === 0) return null;

  return (
    <div className={cn("overflow-x-auto", className)}>
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

        {stages.map((stage, i) => (
          <div
            key={stage.key}
            ref={(el) => {
              stageRefs.current[i] = el;
            }}
            className={cn(
              "relative z-[1] w-60 flex-shrink-0 rounded-lg border bg-white shadow-sm overflow-hidden",
              !reducedMotion && "animate-fade-up"
            )}
            style={!reducedMotion ? { animationDelay: `${i * 90}ms` } : undefined}
          >
            <div className="px-3 py-2 border-b bg-muted/40 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-info-strong truncate">{stage.titulo}</span>
              {stage.subtitulo && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{stage.subtitulo}</span>
              )}
            </div>
            <div>
              {stage.nodes.length === 0 ? (
                <div className="px-3 py-2.5 text-[11px] text-muted-foreground text-center">sem disciplinas</div>
              ) : (
                stage.nodes.map((node) => {
                  const config = STATUS_VISUAL_CONFIG[node.status];
                  const Icon = config.icon;
                  return (
                    <button
                      key={node.key}
                      type="button"
                      onClick={() => onNodeClick?.(node.key)}
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
                        <span className="block text-xs font-medium truncate">{node.titulo}</span>
                        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {node.responsavelNome && (
                            <span className="flex items-center gap-0.5 truncate">
                              <User className="h-2.5 w-2.5" /> {node.responsavelNome}
                            </span>
                          )}
                          {node.metaLabel && <span>{node.metaLabel}</span>}
                          {node.checklistLabel && <span className="flex-shrink-0">{node.checklistLabel}</span>}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
