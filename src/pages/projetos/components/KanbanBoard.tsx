import { PROJECT_STATUS_CONFIG } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { KanbanColumn } from "@/pages/projetos/components/KanbanColumn";

const statusConfig = PROJECT_STATUS_CONFIG;

interface KanbanBoardProps {
  collapsedColumns: Set<string>;
  loadingProjetos: boolean;
  canEdit: boolean;
  clientes: { id: string; nome: string }[];
  rentabilidadeMap: Record<string, number>;
  getProjetosByStatus: (status: string) => Projeto[];
  onToggleColumn: (status: string) => void;
  onCardClick: (projeto: Projeto) => void;
  onEditClick: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onQuickAddCreated: () => void;
}

// Quadro Kanban (desktop): renderiza uma coluna por status na ordem de statusConfig.
export function KanbanBoard({
  collapsedColumns,
  loadingProjetos,
  canEdit,
  clientes,
  rentabilidadeMap,
  getProjetosByStatus,
  onToggleColumn,
  onCardClick,
  onEditClick,
  onDelete,
  onQuickAddCreated,
}: KanbanBoardProps) {
  return (
    <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
      {Object.entries(statusConfig).map(([status, config]) => (
        <KanbanColumn
          key={status}
          status={status}
          config={config}
          items={getProjetosByStatus(status)}
          isCollapsed={collapsedColumns.has(status)}
          loadingProjetos={loadingProjetos}
          canEdit={canEdit}
          clientes={clientes}
          rentabilidadeMap={rentabilidadeMap}
          onToggleColumn={onToggleColumn}
          onCardClick={onCardClick}
          onEditClick={onEditClick}
          onDelete={onDelete}
          onQuickAddCreated={onQuickAddCreated}
        />
      ))}
    </div>
  );
}
