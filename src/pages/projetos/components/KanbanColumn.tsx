import { ChevronLeft, ChevronRight } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";
import { ProjetoColumnSkeleton } from "@/pages/projetos/components/ProjetoCardSkeleton";
import { QuickAddCard } from "@/pages/projetos/components/QuickAddCard";
import { STATUS_DOT } from "@/pages/projetos/lib/statusDot";

type StatusConfigValue = (typeof PROJECT_STATUS_CONFIG)[keyof typeof PROJECT_STATUS_CONFIG];

interface KanbanColumnProps {
  status: string;
  config: StatusConfigValue;
  items: Projeto[];
  isCollapsed: boolean;
  loadingProjetos: boolean;
  canEdit: boolean;
  clientes: { id: string; nome: string }[];
  rentabilidadeMap: Record<string, number>;
  onToggleColumn: (status: string) => void;
  onCardClick: (projeto: Projeto) => void;
  onEditClick: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onQuickAddCreated: () => void;
}

// Uma coluna do quadro (desktop): cabeçalho com status/contagem, área de drop
// e cards arrastáveis. No estado minimizado vira uma faixa vertical clicável.
export function KanbanColumn({
  status,
  config,
  items,
  isCollapsed,
  loadingProjetos,
  canEdit,
  clientes,
  rentabilidadeMap,
  onToggleColumn,
  onCardClick,
  onEditClick,
  onDelete,
  onQuickAddCreated,
}: KanbanColumnProps) {
  const dotColor = STATUS_DOT[status] || "bg-status-unknown";

  if (isCollapsed) {
    return (
      <div
        className="flex flex-col w-10 flex-shrink-0 min-h-0 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => onToggleColumn(status)}
      >
        <div className="flex flex-col items-center gap-2 py-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className={cn("h-2 w-2 rounded-full", dotColor)} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {config.label} · {items.length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 min-h-0">
      <div className="flex items-center gap-2 px-2 py-2.5">
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
        <h3 className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
          {config.label}
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-11 w-11 -my-2 text-muted-foreground"
          onClick={() => onToggleColumn(status)}
          title="Minimizar coluna"
          aria-label="Minimizar coluna"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-lg bg-muted/30 transition-all",
              snapshot.isDraggingOver && "ring-2 ring-brand/40 bg-brand/5"
            )}
          >
            {loadingProjetos && <ProjetoColumnSkeleton count={2} />}
            {!loadingProjetos && items.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center py-6 text-[11px] text-muted-foreground/60 text-center px-2">
                Solte um projeto aqui
              </div>
            )}
            {items.map((projeto, index) => (
              <Draggable key={projeto.id} draggableId={projeto.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <ProjectCard
                      projeto={projeto}
                      onClick={onCardClick}
                      onEdit={onEditClick}
                      onDelete={onDelete}
                      canEdit={canEdit}
                      isDragging={snapshot.isDragging}
                      margemBrutaPct={rentabilidadeMap[projeto.id] ?? null}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {canEdit && !loadingProjetos && (
              <QuickAddCard
                status={status as ProjectStatus}
                clientes={clientes}
                onCreated={onQuickAddCreated}
              />
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
