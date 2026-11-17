import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { KANBAN_BOARD_CLASS } from "@/components/kanban/kanbanLayout";
import { KanbanColumn, KanbanDraggable } from "@/components/kanban/KanbanColumn";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";
import type { ResumoCusto } from "@/pages/obras/lib/semaforoCusto";
import { ObraCard, STATUS_OBRA } from "./ObraCard";

const COR_COLUNA: Record<string, string> = {
  planejada: "hsl(var(--status-planning))",
  em_andamento: "hsl(var(--status-progress))",
  paralisada: "hsl(var(--status-paused))",
  concluida: "hsl(var(--status-done))",
};

/** Quadro de obras por status, igual ao de Projetos: arrastar o card muda o status. */
export function ObrasQuadro({
  obras,
  podeEditar,
  onMudarStatus,
  custos,
}: {
  obras: ObraResumo[];
  podeEditar: boolean;
  onMudarStatus: (obra: ObraResumo, status: string) => void;
  custos?: ReadonlyMap<string, ResumoCusto>;
}) {
  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const obra = obras.find((o) => o.id === r.draggableId);
    if (obra) onMudarStatus(obra, r.destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={KANBAN_BOARD_CLASS}>
        {STATUS_OBRA.map((col) => {
          const doStatus = obras.filter((o) => o.status === col.status);
          return (
            <KanbanColumn
              key={col.status}
              id={col.status}
              title={col.titulo}
              color={COR_COLUNA[col.status]}
              count={doStatus.length}
              dropDisabled={!podeEditar}
            >
              {doStatus.map((obra, index) => (
                <KanbanDraggable key={obra.id} id={obra.id} index={index}>
                  {(isDragging) => (
                    <ObraCard
                      obra={obra}
                      isDragging={isDragging}
                      canEdit={podeEditar}
                      onMoveStatus={onMudarStatus}
                      custo={custos?.get(obra.id)}
                    />
                  )}
                </KanbanDraggable>
              ))}
            </KanbanColumn>
          );
        })}
      </div>
    </DragDropContext>
  );
}
