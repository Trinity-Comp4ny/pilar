import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";
import { STATUS_DOT } from "@/pages/projetos/lib/statusDot";

const statusConfig = PROJECT_STATUS_CONFIG;

interface ProjetosMobileListProps {
  canEdit: boolean;
  rentabilidadeMap: Record<string, number>;
  getProjetosByStatus: (status: string) => Projeto[];
  onCardClick: (projeto: Projeto) => void;
  onEditClick: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onMoveStatus: (projetoId: string, newStatus: string) => void;
}

// Lista de projetos por status para telas pequenas: uma seção <details> por
// status com cards. Sem drag-and-drop; a mudança de status vem do menu do card.
export function ProjetosMobileList({
  canEdit,
  rentabilidadeMap,
  getProjetosByStatus,
  onCardClick,
  onEditClick,
  onDelete,
  onMoveStatus,
}: ProjetosMobileListProps) {
  return (
    <div className="md:hidden space-y-3">
      {Object.entries(statusConfig).map(([status, config]) => {
        const items = getProjetosByStatus(status);
        const dotColor = STATUS_DOT[status] || "bg-status-unknown";
        if (items.length === 0) return null;
        return (
          <details key={status} open className="border rounded-lg bg-white">
            <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none">
              <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
              <span className="text-xs font-medium uppercase tracking-wide flex-1">{config.label}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="p-2 space-y-2 border-t bg-muted/20">
              {items.map((projeto) => (
                <ProjectCard
                  key={projeto.id}
                  projeto={projeto}
                  onClick={onCardClick}
                  onEdit={onEditClick}
                  onDelete={onDelete}
                  onMoveStatus={canEdit ? onMoveStatus : undefined}
                  canEdit={canEdit}
                  margemBrutaPct={rentabilidadeMap[projeto.id] ?? null}
                />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
