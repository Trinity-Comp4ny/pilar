import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { agruparPorEtapa, type ItemTrabalho } from "../useItensTrabalho";
import type { Etapa } from "../useEtapas";
import type { Prioridade } from "../status";
import { CardTrabalho } from "./CardTrabalho";

export type EtapaControls = {
  etapas: Etapa[];
  onNova: () => void;
  onRenomear: (etapa: Etapa) => void;
  onExcluir: (etapa: Etapa) => void;
  onReordenar: (id: string, dir: -1 | 1) => void;
};

type Props = {
  itens: ItemTrabalho[];
  onAbrir: (item: ItemTrabalho) => void;
  onPrioridade: (item: ItemTrabalho, prioridade: Prioridade) => void;
  onExcluir: (item: ItemTrabalho) => void;
  /** Arrastou o card para outra coluna: destino = id da etapa alvo. */
  onMover: (item: ItemTrabalho, destinoEtapaId: string) => void;
  etapaControls: EtapaControls;
};

export function QuadroTrabalho({ itens, onAbrir, onPrioridade, onExcluir, onMover, etapaControls }: Props) {
  const { etapas } = etapaControls;
  const grupos = agruparPorEtapa(itens, etapas);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    const item = itens.find((i) => i.key === draggableId);
    if (!item) return;
    onMover(item, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {grupos.map((grupo, idx) => {
          const etapa = etapas.find((e) => e.id === grupo.chave);
          const podeExcluir = etapa != null && etapa.bucket == null; // âncora de status não sai
          return (
            <section key={grupo.chave} className="flex w-72 shrink-0 flex-col">
              <header className="mb-2 flex items-center gap-2 px-1">
                <h3 className="truncate text-sm font-medium text-foreground">{grupo.titulo}</h3>
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{grupo.itens.length}</span>
                {etapa && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" aria-label="Ações da coluna">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => etapaControls.onRenomear(etapa)}>
                        <Pencil className="mr-2 h-4 w-4" /> Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={idx === 0} onClick={() => etapaControls.onReordenar(etapa.id, -1)}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Mover para esquerda
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={idx >= etapas.length - 1}
                        onClick={() => etapaControls.onReordenar(etapa.id, 1)}
                      >
                        <ChevronRight className="mr-2 h-4 w-4" /> Mover para direita
                      </DropdownMenuItem>
                      {podeExcluir && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => etapaControls.onExcluir(etapa)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir coluna
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </header>
              <Droppable droppableId={grupo.chave}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex min-h-[3rem] flex-1 flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-colors",
                      snapshot.isDraggingOver && "bg-brand/5 ring-2 ring-brand/40"
                    )}
                  >
                    {grupo.itens.length === 0 && !snapshot.isDraggingOver ? (
                      <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nada aqui</p>
                    ) : (
                      grupo.itens.map((item, index) => (
                        <Draggable key={item.key} draggableId={item.key} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(dragSnapshot.isDragging && "opacity-90")}
                            >
                              <CardTrabalho
                                item={item}
                                onAbrir={onAbrir}
                                onPrioridade={onPrioridade}
                                onExcluir={onExcluir}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          );
        })}

        <button
          type="button"
          onClick={etapaControls.onNova}
          className="mt-8 flex h-11 w-56 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Nova coluna
        </button>
      </div>
    </DragDropContext>
  );
}
