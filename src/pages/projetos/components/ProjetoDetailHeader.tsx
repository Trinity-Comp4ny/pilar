import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit } from "lucide-react";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import type { Projeto } from "@/types/projetos";

interface DeadlineInfo {
  label: string;
  color: string;
  days: number;
}

interface ProjetoDetailHeaderProps {
  projeto: Projeto;
  deadline: DeadlineInfo | null;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}

export function ProjetoDetailHeader({ projeto, deadline, canEdit, onBack, onEdit }: ProjetoDetailHeaderProps) {
  const priorityConfig = PROJECT_PRIORITY_CONFIG[projeto.prioridade as ProjectPriority];

  return (
    <div className="flex items-center gap-3 mb-6">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold">{projeto.codigo_projeto}</h1>
          <Badge className={PROJECT_STATUS_CONFIG[projeto.status]?.color}>
            {PROJECT_STATUS_CONFIG[projeto.status]?.label}
          </Badge>
          {priorityConfig && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}
            >
              {priorityConfig.label}
            </span>
          )}
          {deadline && (
            <Badge className={deadline.color + " text-[10px]"}>
              {deadline.label} {deadline.days > 0 ? `(${deadline.days}d)` : ""}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{projeto.nome}</p>
      </div>
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-3.5 w-3.5 mr-1.5" />
          Editar Projeto
        </Button>
      )}
    </div>
  );
}
