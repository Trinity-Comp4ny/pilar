import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  KANBAN_COLUMN_ORDER,
  PRIORITY_OPTIONS,
  PROJECT_STATUS_CONFIG,
  PROJECT_PRIORITY_CONFIG,
  type ProjectPriority,
} from "@/constants";
import type { Projeto } from "@/types/projetos";

interface DeadlineInfo {
  label: string;
  color: string;
  days: number;
}

interface ProjetoDetailHeaderProps {
  projeto: Projeto;
  deadline: DeadlineInfo | null;
  canEdit?: boolean;
  onUpdateStatus?: (status: string) => void;
  onUpdatePrioridade?: (prioridade: ProjectPriority) => void;
}

// Strip de contexto do projeto (código + status + prazo). O título e a trilha
// ficam no PageHeader; a navegação de "voltar" virou o breadcrumb (spec 006).
export function ProjetoDetailHeader({
  projeto,
  deadline,
  canEdit = false,
  onUpdateStatus,
  onUpdatePrioridade,
}: ProjetoDetailHeaderProps) {
  const priorityConfig = PROJECT_PRIORITY_CONFIG[projeto.prioridade as ProjectPriority];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-bold">{projeto.codigo_projeto}</h2>

        {canEdit && onUpdateStatus ? (
          <Select value={projeto.status} onValueChange={onUpdateStatus}>
            <SelectTrigger
              className={cn(
                "h-6 w-auto text-xs font-medium rounded-full border-0 px-2.5 gap-1",
                PROJECT_STATUS_CONFIG[projeto.status]?.color
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_COLUMN_ORDER.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {PROJECT_STATUS_CONFIG[s]?.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge className={PROJECT_STATUS_CONFIG[projeto.status]?.color}>
            {PROJECT_STATUS_CONFIG[projeto.status]?.label}
          </Badge>
        )}

        {canEdit && onUpdatePrioridade ? (
          <Select value={projeto.prioridade} onValueChange={(v) => onUpdatePrioridade(v as ProjectPriority)}>
            <SelectTrigger
              className={cn(
                "h-6 w-auto text-[10px] font-medium rounded-full border-0 px-2.5 gap-1",
                priorityConfig?.bgColor,
                priorityConfig?.color
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", PROJECT_PRIORITY_CONFIG[p].dotColor)} />
                    {PROJECT_PRIORITY_CONFIG[p].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          priorityConfig && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}
            >
              {priorityConfig.label}
            </span>
          )
        )}

        {deadline && (
          <Badge className={deadline.color + " text-[10px]"}>
            {deadline.label} {deadline.days > 0 ? `(${deadline.days}d)` : ""}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{projeto.nome}</p>
    </div>
  );
}
