import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertTriangle, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DisciplinaResponsavel, getDiscDeadlineStatus } from "@/types/projetos";

interface EtapaGroup {
  etapa: number;
  disciplinas: DisciplinaResponsavel[];
  status: "concluido" | "em_andamento" | "atrasado" | "nao_iniciado";
  label: string;
}

function getEtapaStatus(disciplinas: DisciplinaResponsavel[]): EtapaGroup["status"] {
  const hasAtrasada = disciplinas.some((d) => {
    const s = getDiscDeadlineStatus(d);
    return s?.status_data === "em_atraso";
  });
  if (hasAtrasada) return "atrasado";

  const allConcluido = disciplinas.every((d) => d.status === "Concluído");
  if (allConcluido) return "concluido";

  const hasEmAndamento = disciplinas.some((d) => d.status === "Em Andamento" || d.status === "Pendente");
  if (hasEmAndamento) return "em_andamento";

  return "nao_iniciado";
}

const STATUS_CONFIG = {
  concluido: {
    bg: "bg-green-500",
    border: "border-green-500",
    text: "text-green-700",
    icon: CheckCircle2,
    label: "Concluído",
  },
  em_andamento: {
    bg: "bg-blue-500",
    border: "border-blue-500",
    text: "text-blue-700",
    icon: Clock,
    label: "Em Andamento",
  },
  atrasado: {
    bg: "bg-red-500",
    border: "border-red-500",
    text: "text-red-700",
    icon: AlertTriangle,
    label: "Atrasado",
  },
  nao_iniciado: {
    bg: "bg-gray-300",
    border: "border-gray-300",
    text: "text-gray-500",
    icon: PauseCircle,
    label: "Não Iniciado",
  },
};

interface FluxoPipelineProps {
  disciplinas: DisciplinaResponsavel[];
}

export function FluxoPipeline({ disciplinas }: FluxoPipelineProps) {
  const etapas = useMemo((): EtapaGroup[] => {
    const map = new Map<number, DisciplinaResponsavel[]>();

    for (const d of disciplinas) {
      if (d.etapa == null) continue;
      if (!map.has(d.etapa)) map.set(d.etapa, []);
      map.get(d.etapa)!.push(d);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([etapa, discs]) => ({
        etapa,
        disciplinas: discs,
        status: getEtapaStatus(discs),
        label: discs.map((d) => d.disciplina).join(", "),
      }));
  }, [disciplinas]);

  if (etapas.length === 0) return null;

  const concluidas = etapas.filter((e) => e.status === "concluido").length;
  const progresso = Math.round((concluidas / etapas.length) * 100);

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Fluxo de Disciplinas</span>
        <span className="text-xs text-muted-foreground">
          {concluidas}/{etapas.length} etapas concluídas ({progresso}%)
        </span>
      </div>

      <div className="flex items-center gap-0 overflow-x-auto py-1">
        {etapas.map((etapa, i) => {
          const config = STATUS_CONFIG[etapa.status];
          const Icon = config.icon;

          return (
            <div key={etapa.etapa} className="flex items-center flex-shrink-0">
              {i > 0 && (
                <div
                  className={cn(
                    "w-6 sm:w-10 h-0.5",
                    etapas[i - 1].status === "concluido" ? "bg-green-400" : "bg-gray-200"
                  )}
                />
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 cursor-default">
                    <div
                      className={cn(
                        "flex items-center justify-center h-8 w-8 rounded-full border-2 transition-colors",
                        config.border,
                        etapa.status === "concluido" ? config.bg : "bg-white"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", etapa.status === "concluido" ? "text-white" : config.text)} />
                    </div>
                    <span className={cn("text-[10px] font-medium max-w-[80px] truncate text-center", config.text)}>
                      Etapa {etapa.etapa}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="space-y-1">
                    <div className="font-medium">
                      Etapa {etapa.etapa} — {config.label}
                    </div>
                    {etapa.disciplinas.map((d, di) => (
                      <div key={di} className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            d.status === "Concluído"
                              ? "bg-green-500"
                              : d.status === "Em Andamento"
                                ? "bg-blue-500"
                                : "bg-gray-300"
                          )}
                        />
                        {d.disciplina} — {d.status || "Não Iniciado"}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
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
