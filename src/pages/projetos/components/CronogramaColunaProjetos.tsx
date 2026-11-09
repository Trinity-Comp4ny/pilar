import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { AlertTriangle, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { DisciplinaLeftRows } from "./CronogramaDisciplinaRows";

export interface LinhaColunaProjeto {
  projeto: Projeto;
  atrasado: boolean;
  barClass: string;
}

interface CronogramaColunaProjetosProps {
  rows: LinhaColunaProjeto[];
  isMobile: boolean;
  isExpanded: (projetoId: string) => boolean;
  onToggleExpand: (projetoId: string) => void;
  onOpen: (projetoId: string) => void;
  /** Coordenador sem filtro ativo: a alça de arraste aparece (SPEC 143). */
  podeReordenar: boolean;
  onReordenar: (de: number, para: number) => void;
  /** Modo "Meus projetos": só as disciplinas dessa pessoa, as outras ficam atrás de um "+N". */
  pessoaId?: string;
  outrasAbertas: Set<string>;
  onToggleOutras: (projetoId: string) => void;
}

/** Coluna fixa à esquerda do cronograma de projetos: selo de prioridade, nome e disciplinas. */
export function CronogramaColunaProjetos({
  rows,
  isMobile,
  isExpanded,
  onToggleExpand,
  onOpen,
  podeReordenar,
  onReordenar,
  pessoaId,
  outrasAbertas,
  onToggleOutras,
}: CronogramaColunaProjetosProps) {
  // A alça é um div, não um button: o hello-pangea não inicia arraste a partir de elemento interativo.
  const aoSoltar = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    onReordenar(r.source.index, r.destination.index);
  };

  return (
    // Mobile: a coluna fixa de 260px sozinha consumia 66% de uma tela de 390px; some o status e o
    // cliente e a alça de arraste, e fica só o nome truncado.
    <div className={cn("shrink-0 border-r bg-muted/30", isMobile ? "w-[104px]" : "w-[260px]")}>
      <div className="h-10 border-b px-3 flex items-center">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {pessoaId ? "Meus projetos" : "Projeto"}
        </span>
      </div>
      <DragDropContext onDragEnd={aoSoltar}>
        <Droppable droppableId="cronograma-projetos" isDropDisabled={!podeReordenar}>
          {(drop) => (
            <div ref={drop.innerRef} {...drop.droppableProps}>
              {rows.map((row, index) => {
                const { projeto } = row;
                const cfg = PROJECT_STATUS_CONFIG[projeto.status];
                const aberto = isExpanded(projeto.id);
                return (
                  <Draggable key={projeto.id} draggableId={projeto.id} index={index} isDragDisabled={!podeReordenar}>
                    {(drag, snap) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={cn(
                          "border-b",
                          row.atrasado && "bg-danger-soft/40",
                          snap.isDragging && "bg-card shadow-md"
                        )}
                      >
                        <div className="w-full h-14 flex items-stretch">
                          {podeReordenar && (
                            <div
                              {...drag.dragHandleProps}
                              aria-label={`Arrastar para reordenar ${projeto.nome}`}
                              className="shrink-0 w-5 flex items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-grab"
                            >
                              <GripVertical className="h-3.5 w-3.5" aria-hidden />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => onToggleExpand(projeto.id)}
                            className="shrink-0 w-6 flex items-center justify-center hover:bg-muted/50 transition-colors"
                            aria-label={aberto ? "Recolher disciplinas" : "Expandir disciplinas"}
                          >
                            <ChevronRight
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                aberto && "rotate-90"
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpen(projeto.id)}
                            className="flex-1 min-w-0 h-full pr-3 flex flex-col justify-center text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              {row.atrasado && <AlertTriangle className="h-3 w-3 text-danger-mid shrink-0" />}
                              {projeto.ordem_prioridade != null && (
                                <span
                                  className="shrink-0 rounded bg-brand/40 px-1.5 text-[10px] font-semibold tabular-nums"
                                  aria-label={`Prioridade ${projeto.ordem_prioridade}`}
                                >
                                  #{projeto.ordem_prioridade}
                                </span>
                              )}
                              <span className="text-xs font-medium truncate">{projeto.nome}</span>
                            </div>
                            {!isMobile && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", row.barClass)}
                                  aria-hidden
                                />
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {cfg?.label || projeto.status}
                                  {projeto.cliente_nome && ` · ${projeto.cliente_nome}`}
                                </span>
                              </div>
                            )}
                          </button>
                        </div>
                        {aberto && (
                          <DisciplinaLeftRows
                            projetoId={projeto.id}
                            pessoaId={pessoaId}
                            mostrarOutras={outrasAbertas.has(projeto.id)}
                            onMostrarOutras={() => onToggleOutras(projeto.id)}
                          />
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {drop.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
