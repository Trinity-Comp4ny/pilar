import { Badge } from "@/components/ui/badge";
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
}

// Strip de contexto do projeto (código + status + prazo). O título e a trilha
// ficam no PageHeader; a navegação de "voltar" virou o breadcrumb (spec 006).
export function ProjetoDetailHeader({ projeto, deadline }: ProjetoDetailHeaderProps) {
  const priorityConfig = PROJECT_PRIORITY_CONFIG[projeto.prioridade as ProjectPriority];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-bold">{projeto.codigo_projeto}</h2>
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
  );
}
