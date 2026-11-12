import { AlertTriangle, CheckCircle2, Clock, Layers } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { KpiResumo } from "@/components/KpiResumo";
import { CollapsibleKpiSection } from "@/components/CollapsibleKpiSection";

export interface DisciplinasMetricas {
  total: number;
  concluidas: number;
  emAndamento: number;
  atrasadas: number;
  emAtencao: number;
  progressoPct: number;
}

/**
 * Indicadores da aba Disciplinas, recolhíveis e com resumo numa linha quando recolhidos
 * (auditoria de espaço, 2026-11). Antes eram cinco cards fixos de ~107 px acima da lista.
 */
export function DisciplinasKPIs({ metrics }: { metrics: DisciplinasMetricas }) {
  return (
    <CollapsibleKpiSection
      storageKey="disciplinas"
      resumo={
        <KpiResumo
          itens={[
            { texto: `${metrics.concluidas} concluídas (${metrics.progressoPct}%)` },
            { texto: `${metrics.emAndamento} em andamento` },
            { texto: `${metrics.emAtencao} em atenção` },
            { texto: `${metrics.atrasadas} atrasadas`, alerta: metrics.atrasadas > 0 },
          ]}
        />
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KPICard
          density="compact"
          icon={CheckCircle2}
          label="Concluídas"
          value={metrics.concluidas.toString()}
          tone="positive"
          subtitle={`${metrics.progressoPct}%`}
        />
        <KPICard
          density="compact"
          icon={Clock}
          label="Em Andamento"
          value={metrics.emAndamento.toString()}
          tone="info"
        />
        <KPICard density="compact" icon={Clock} label="Atenção" value={metrics.emAtencao.toString()} tone="warning" />
        <KPICard
          density="compact"
          icon={AlertTriangle}
          label="Atrasadas"
          value={metrics.atrasadas.toString()}
          tone="danger"
        />
        <KPICard
          density="compact"
          icon={Layers}
          label="Total"
          value={metrics.total.toString()}
          tone="neutral"
          subtitle="atribuições"
        />
      </div>
    </CollapsibleKpiSection>
  );
}
