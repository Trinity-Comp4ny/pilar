import type { ReactNode } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { KANBAN_COLUMN_WIDTH } from "./kanbanLayout";

export type KanbanColumnActions = {
  primeira: boolean;
  ultima: boolean;
  onEditar: () => void;
  onMover: (dir: -1 | 1) => void;
  /** Ausente quando a coluna não pode sair (ex.: âncora de status). */
  onExcluir?: () => void;
};

type Props = {
  /** `droppableId`: id da coluna (etapa). */
  id: string;
  title: string;
  /** Cor do ponto (hex da etapa). */
  color: string;
  count: number;
  /** Menu da coluna (editar, mover, excluir). Omitir quando o usuário não edita. */
  actions?: KanbanColumnActions;
  /** Quando existe, mostra o botão de minimizar; a tela guarda o estado. */
  onCollapse?: () => void;
  collapsed?: boolean;
  /** Coluna só de leitura: não aceita soltar cards (ex.: "Sem coluna"). */
  dropDisabled?: boolean;
  /** Esqueleto mostrado no lugar dos cards enquanto carrega. */
  loading?: ReactNode;
  /** Conteúdo depois dos cards, dentro da superfície (ex.: adicionar rápido). */
  footer?: ReactNode;
  children?: ReactNode;
};

/**
 * Coluna única dos quadros Kanban (SPEC 122): cabeçalho (ponto, nome, contagem,
 * menu), superfície de soltar e estado vazio. Cards entram como `children`,
 * cada um dentro de um `KanbanDraggable`.
 */
export function KanbanColumn({
  id,
  title,
  color,
  count,
  actions,
  onCollapse,
  collapsed,
  dropDisabled,
  loading,
  footer,
  children,
}: Props) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onCollapse}
        aria-label={`Expandir coluna ${title}`}
        className="flex min-h-0 w-10 shrink-0 cursor-pointer flex-col rounded-xl bg-muted/40 transition-colors hover:bg-muted/70"
      >
        <span className="flex flex-col items-center gap-2 py-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        </span>
        <span className="flex flex-1 items-center justify-center">
          <span
            className="whitespace-nowrap text-xs font-medium text-muted-foreground"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {title} · {count}
          </span>
        </span>
      </button>
    );
  }

  return (
    <section className={cn("flex min-h-0 shrink-0 flex-col", KANBAN_COLUMN_WIDTH)}>
      <header className="flex h-10 items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
        <div className="ml-auto flex items-center">
          {actions && <KanbanColumnMenu {...actions} />}
          {onCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={onCollapse}
              title="Minimizar coluna"
              aria-label="Minimizar coluna"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <Droppable droppableId={id} isDropDisabled={dropDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-muted/40 p-2 transition-colors",
              snapshot.isDraggingOver && "bg-brand/5 ring-2 ring-brand/40"
            )}
          >
            {loading ??
              (count === 0 && !snapshot.isDraggingOver ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nada aqui</p>
              ) : (
                children
              ))}
            {provided.placeholder}
            {footer}
          </div>
        )}
      </Droppable>
    </section>
  );
}

function KanbanColumnMenu({ primeira, ultima, onEditar, onMover, onExcluir }: KanbanColumnActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Ações da coluna">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEditar}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={primeira} onClick={() => onMover(-1)}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Mover para esquerda
        </DropdownMenuItem>
        <DropdownMenuItem disabled={ultima} onClick={() => onMover(1)}>
          <ChevronRight className="mr-2 h-4 w-4" /> Mover para direita
        </DropdownMenuItem>
        {onExcluir && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onExcluir}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir coluna
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Envolve um card arrastável. O arraste por teclado (espaço) fica neste elemento. */
export function KanbanDraggable({
  id,
  index,
  children,
}: {
  id: string;
  index: number;
  children: (isDragging: boolean) => ReactNode;
}) {
  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          // O card tem botões dentro; role="button" aninharia controles.
          role="group"
          aria-roledescription="cartão arrastável"
        >
          {children(snapshot.isDragging)}
        </div>
      )}
    </Draggable>
  );
}
