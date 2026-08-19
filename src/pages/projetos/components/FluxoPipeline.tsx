import { useMemo } from "react";
import { type DisciplinaResponsavel, getDiscDeadlineStatus } from "@/types/projetos";
import { formatDateShort } from "@/lib/dateUtils";
import type { ChecklistCounts } from "@/hooks/useProjetoDisciplinaChecklist";
import { FluxoPipelineGraph, type FluxoNodeStatus, type FluxoPipelineStage } from "./FluxoPipelineGraph";

function getDiscStatusVisual(disc: DisciplinaResponsavel): FluxoNodeStatus {
  if (disc.status === "Concluído") return "concluido";
  const deadline = getDiscDeadlineStatus(disc);
  if (deadline?.status_data === "em_atraso") return "atrasado";
  if (disc.status === "Em Andamento") return "em_andamento";
  return "nao_iniciado";
}

interface FluxoPipelineProps {
  disciplinas: DisciplinaResponsavel[];
  onOpenDisciplina?: (disc: DisciplinaResponsavel) => void;
  /** Chave = projeto_disciplina.id. Ausente = disciplina sem checklist (sem badge). */
  checklistCounts?: Record<string, ChecklistCounts>;
}

/** Key do nó no grafo: disc.id quando persistida, senão um índice estável dentro da etapa. */
function nodeKeyFor(disc: DisciplinaResponsavel, etapa: number | null, index: number): string {
  return disc.id ?? `${etapa}-${index}`;
}

export function FluxoPipeline({ disciplinas, onOpenDisciplina, checklistCounts }: FluxoPipelineProps) {
  const etapas = useMemo(() => groupByEtapa(disciplinas).filter((e) => e.etapa != null), [disciplinas]);

  const { stages, nodeMap } = useMemo(() => {
    const map = new Map<string, DisciplinaResponsavel>();
    const built: FluxoPipelineStage[] = etapas.map((etapa) => ({
      key: String(etapa.etapa),
      titulo: etapa.nome,
      nodes: etapa.disciplinas.map((disc, i) => {
        const key = nodeKeyFor(disc, etapa.etapa, i);
        map.set(key, disc);
        const counts = disc.id ? checklistCounts?.[disc.id] : undefined;
        return {
          key,
          titulo: disc.disciplina,
          status: getDiscStatusVisual(disc),
          responsavelNome: disc.responsavel_nome || undefined,
          metaLabel: disc.data_previsao ? formatDateShort(disc.data_previsao) : undefined,
          checklistLabel: counts && counts.total > 0 ? `${counts.concluidos}/${counts.total}` : undefined,
        };
      }),
    }));
    return { stages: built, nodeMap: map };
  }, [etapas, checklistCounts]);

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

      <FluxoPipelineGraph
        stages={stages}
        onNodeClick={(key) => {
          const disc = nodeMap.get(key);
          if (disc) onOpenDisciplina?.(disc);
        }}
      />
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
