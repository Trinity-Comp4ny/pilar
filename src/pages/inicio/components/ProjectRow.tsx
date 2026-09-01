import { Badge } from "@/components/ui/badge";
import { Clock, ChevronRight } from "lucide-react";
import type { DashboardProjeto } from "@/hooks/useDashboardData";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG, type ProjectStatus, type ProjectPriority } from "@/constants";
import { cn } from "@/lib/utils";
import { useMoneyMask } from "@/hooks/useMoneyMask";

export function ProjectRow({ project, onClick }: { project: DashboardProjeto; onClick: () => void }) {
  const formatCurrency = useMoneyMask();
  const statusConfig = PROJECT_STATUS_CONFIG[project.status as ProjectStatus];
  const priorityConfig = PROJECT_PRIORITY_CONFIG[project.prioridade as ProjectPriority];
  const isAtrasado = project.statusData === "em_atraso" || project.progressoPrazo > 100;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-ink-soft font-semibold text-sm shrink-0">
        {project.nome.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {priorityConfig && (
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", priorityConfig.dotColor)}
              title={`Prioridade ${priorityConfig.label.toLowerCase()}`}
            >
              <span className="sr-only">Prioridade {priorityConfig.label.toLowerCase()}</span>
            </span>
          )}
          <h3 className="text-sm font-medium text-ink truncate">{project.nome}</h3>
          <Badge className={`text-[10px] px-1.5 py-0 h-4 ${statusConfig?.color || "bg-muted text-ink-soft"}`}>
            {project.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-ink-disabled">{project.cliente}</span>
          {project.dataPrevisao && (
            <span
              className={`text-xs flex items-center gap-0.5 ${isAtrasado ? "text-chart-danger" : "text-ink-disabled"}`}
            >
              <Clock size={10} />
              {new Date(project.dataPrevisao + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-sm font-medium">
          {project.valorContrato > 0 ? formatCurrency(project.valorContrato, { compact: true }) : "—"}
        </div>
        {project.dataInicio && project.dataPrevisao && (
          <div className="w-16 mt-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isAtrasado ? "bg-chart-danger" : project.progressoPrazo > 75 ? "bg-chart-warning" : "bg-status-done"}`}
                style={{ width: `${Math.min(project.progressoPrazo, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <ChevronRight size={14} className="text-ink-disabled group-hover:text-muted-foreground shrink-0" />
    </div>
  );
}
