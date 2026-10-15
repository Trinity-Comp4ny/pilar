import { KanbanColumn as ColunaPadrao, KanbanDraggable } from "@/components/kanban/KanbanColumn";
import { type Projeto } from "@/types/projetos";
import { corDaEtapaProjeto, type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";
import { ProjetoColumnSkeleton } from "@/pages/projetos/components/ProjetoCardSkeleton";
import { QuickAddCard } from "@/pages/projetos/components/QuickAddCard";

interface KanbanColumnProps {
  etapa: ProjetoEtapa;
  /** Posição na lista de etapas (para desabilitar mover na ponta). */
  index: number;
  total: number;
  items: Projeto[];
  isCollapsed: boolean;
  loadingProjetos: boolean;
  canEdit: boolean;
  clientes: { id: string; nome: string }[];
  rentabilidadeMap: Record<string, number>;
  onToggleColumn: (etapaId: string) => void;
  onEditar: (etapa: ProjetoEtapa) => void;
  onReordenar: (etapaId: string, dir: -1 | 1) => void;
  onExcluir: (etapa: ProjetoEtapa) => void;
  onCardClick: (projeto: Projeto) => void;
  onEditClick: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onQuickAddCreated: () => void;
}

// Coluna do quadro de Projetos: dados da etapa e dos cards sobre a coluna
// padrão dos quadros (`components/kanban/KanbanColumn`, SPEC 122).
export function KanbanColumn({
  etapa,
  index,
  total,
  items,
  isCollapsed,
  loadingProjetos,
  canEdit,
  clientes,
  rentabilidadeMap,
  onToggleColumn,
  onEditar,
  onReordenar,
  onExcluir,
  onCardClick,
  onEditClick,
  onDelete,
  onQuickAddCreated,
}: KanbanColumnProps) {
  return (
    <ColunaPadrao
      id={etapa.id}
      title={etapa.nome}
      color={corDaEtapaProjeto(etapa.cor)}
      count={items.length}
      collapsed={isCollapsed}
      onCollapse={() => onToggleColumn(etapa.id)}
      actions={
        canEdit
          ? {
              primeira: index === 0,
              ultima: index >= total - 1,
              onEditar: () => onEditar(etapa),
              onMover: (dir) => onReordenar(etapa.id, dir),
              onExcluir: () => onExcluir(etapa),
            }
          : undefined
      }
      loading={loadingProjetos ? <ProjetoColumnSkeleton count={2} /> : undefined}
      footer={
        canEdit && !loadingProjetos ? (
          <QuickAddCard etapaId={etapa.id} clientes={clientes} onCreated={onQuickAddCreated} />
        ) : undefined
      }
    >
      {items.map((projeto, idx) => (
        <KanbanDraggable key={projeto.id} id={projeto.id} index={idx}>
          {(isDragging) => (
            <ProjectCard
              projeto={projeto}
              onClick={onCardClick}
              onEdit={onEditClick}
              onDelete={onDelete}
              canEdit={canEdit}
              isDragging={isDragging}
              margemBrutaPct={rentabilidadeMap[projeto.id] ?? null}
            />
          )}
        </KanbanDraggable>
      ))}
    </ColunaPadrao>
  );
}
