import { Users } from "lucide-react";
import type { LeadsPipeline } from "@/hooks/useDashboardData";

const PIPELINE_COLORS: Record<string, string> = {
  Novo: "bg-pipeline-novo",
  "Em contato": "bg-pipeline-contato",
  Proposta: "bg-pipeline-proposta",
  Negociação: "bg-pipeline-negociacao",
  Ganho: "bg-status-done",
  Perdido: "bg-pipeline-perdido",
};

export function LeadsFunnel({ pipeline, total }: { pipeline: LeadsPipeline[]; total: number }) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ink-disabled">
        <Users size={24} className="mb-2" />
        <p className="text-sm">Nenhum lead cadastrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pipeline.map((step) => {
        const pct = total > 0 ? (step.count / total) * 100 : 0;
        return (
          <div key={step.status} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0 truncate">{step.status}</span>
            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${PIPELINE_COLORS[step.status] || "bg-pipeline-perdido"}`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            {/* Contagem fora da barra: cor fixa com contraste garantido, sem depender da cor da barra. */}
            <span className="text-[11px] font-semibold text-ink-soft w-6 shrink-0 text-right tabular-nums">
              {step.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
