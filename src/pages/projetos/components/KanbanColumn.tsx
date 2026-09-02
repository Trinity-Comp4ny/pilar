import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type Projeto } from "@/types/projetos";
import { type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";
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
  onRenomear: (etapa: ProjetoEtapa) => void;
  onReordenar: (etapaId: string, dir: -1 | 1) => void;
  onExcluir: (etapa: ProjetoEtapa) => void;
  onCardClick: (projeto: Projeto) => void;
  onEditClick: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onQuickAddCreated: () => void;
}

// Uma coluna do quadro (desktop): cabeçalho com nome/cor/contagem + menu de
// ações (renomear/mover/excluir), área de drop e cards arrastáveis. No estado
// minimizado vira uma faixa vertical clicável.
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
  onRenomear,
  onReordenar,
  onExcluir,
  onCardClick,
  onEditClick,
  onDelete,
  onQuickAddCreated,
}: KanbanColumnProps) {
  const cor = etapa.cor ?? "#94a3b8";

  if (isCollapsed) {
    return (
      <div
        className="flex flex-col w-10 flex-shrink-0 min-h-0 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => onToggleColumn(etapa.id)}
      >
        <div className="flex flex-col items-center gap-2 py-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {etapa.nome} · {items.length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 min-h-0">
      <div className="flex items-center gap-2 px-2 py-2.5">
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
        <h3 className="text-xs font-medium text-foreground/80 uppercase tracking-wide truncate">{etapa.nome}</h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
        <div className="ml-auto flex items-center">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label="Ações da coluna"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onRenomear(etapa)}>
                  <Pencil className="mr-2 h-4 w-4" /> Renomear
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index === 0} onClick={() => onReordenar(etapa.id, -1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Mover para esquerda
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index >= total - 1} onClick={() => onReordenar(etapa.id, 1)}>
                  <ChevronRight className="mr-2 h-4 w-4" /> Mover para direita
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onExcluir(etapa)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir coluna
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onToggleColumn(etapa.id)}
            title="Minimizar coluna"
            aria-label="Minimizar coluna"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Droppable droppableId={etapa.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-lg bg-muted transition-all",
              snapshot.isDraggingOver && "ring-2 ring-brand/40 bg-brand/5"
            )}
          >
            {loadingProjetos && <ProjetoColumnSkeleton count={2} />}
            {!loadingProjetos && items.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center py-6 text-[11px] text-muted-foreground/60 text-center px-2">
                Solte um projeto aqui
              </div>
            )}
            {items.map((projeto, idx) => (
              <Draggable key={projeto.id} draggableId={projeto.id} index={idx}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
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
              <QuickAddCard etapaId={etapa.id} clientes={clientes} onCreated={onQuickAddCreated} />
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
