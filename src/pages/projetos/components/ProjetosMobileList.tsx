import { PROJECT_STATUS_CONFIG } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { KanbanMobile } from "@/components/kanban/KanbanMobile";
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

// Quadro de projetos no celular: uma coluna por status, lado a lado, passando com o dedo
// (KanbanMobile). Sem drag-and-drop; a mudança de status vem do menu do card.
export function ProjetosMobileList({
  canEdit,
  rentabilidadeMap,
  getProjetosByStatus,
  onCardClick,
  onEditClick,
  onDelete,
  onMoveStatus,
}: ProjetosMobileListProps) {
  const colunas = Object.entries(statusConfig).map(([status, config]) => {
    const items = getProjetosByStatus(status);
    return {
      id: status,
      titulo: config.label,
      cor: STATUS_DOT[status] || "bg-status-unknown",
      quantidade: items.length,
      children: items.map((projeto) => (
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
      )),
    };
  });

  return <KanbanMobile colunas={colunas} ariaLabel="Quadro de projetos" />;
}
