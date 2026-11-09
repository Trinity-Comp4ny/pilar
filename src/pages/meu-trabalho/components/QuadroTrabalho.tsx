import { useMemo } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { AddColumnInline } from "@/components/kanban/AddColumnInline";
import { KANBAN_ADD_COLUMN_CLASSES, KANBAN_BOARD_CLASS } from "@/components/kanban/kanbanLayout";
import { KanbanColumn, KanbanDraggable } from "@/components/kanban/KanbanColumn";
import { ordenarKanban, type KanbanSort } from "@/lib/kanbanSort";
import { TAREFAS_SORT_ACESSORES } from "../ordenacao";
import { agruparPorEtapa, type ItemTrabalho } from "../useItensTrabalho";
import type { Etapa } from "../useEtapas";
import { corDaEtapa, CORES_ETAPA, type Prioridade } from "../status";
import { CardTrabalho } from "./CardTrabalho";

export type EtapaControls = {
  etapas: Etapa[];
  /** Cria a coluna inline. Retorna true no sucesso, para limpar o campo. */
  onCriar: (nome: string, cor: string | null) => Promise<boolean>;
  criando: boolean;
  onEditar: (etapa: Etapa) => void;
  onExcluir: (etapa: Etapa) => void;
  onReordenar: (id: string, dir: -1 | 1) => void;
};

type Props = {
  itens: ItemTrabalho[];
  sort: KanbanSort;
  onAbrir: (item: ItemTrabalho) => void;
  onPrioridade: (item: ItemTrabalho, prioridade: Prioridade) => void;
  onExcluir: (item: ItemTrabalho) => void;
  /** Arrastou o card para outra coluna: destino = id da etapa alvo. */
  onMover: (item: ItemTrabalho, destinoEtapaId: string) => void;
  etapaControls: EtapaControls;
};

export function QuadroTrabalho({ itens, sort, onAbrir, onPrioridade, onExcluir, onMover, etapaControls }: Props) {
  const { etapas } = etapaControls;
  const grupos = useMemo(
    () => agruparPorEtapa(ordenarKanban(itens, sort, TAREFAS_SORT_ACESSORES), etapas),
    [itens, sort, etapas]
  );

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
      <div className={KANBAN_BOARD_CLASS}>
        {grupos.map((grupo, idx) => {
          const etapa = etapas.find((e) => e.id === grupo.chave);
          const podeExcluir = etapa != null && etapa.bucket == null; // âncora de status não sai
          return (
            <KanbanColumn
              key={grupo.chave}
              id={grupo.chave}
              title={grupo.titulo}
              color={corDaEtapa(etapa?.cor ?? null, etapa?.bucket ?? null)}
              count={grupo.itens.length}
              actions={
                etapa
                  ? {
                      primeira: idx === 0,
                      ultima: idx >= etapas.length - 1,
                      onEditar: () => etapaControls.onEditar(etapa),
                      onMover: (dir) => etapaControls.onReordenar(etapa.id, dir),
                      onExcluir: podeExcluir ? () => etapaControls.onExcluir(etapa) : undefined,
                    }
                  : undefined
              }
            >
              {grupo.itens.map((item, index) => (
                <KanbanDraggable key={item.key} id={item.key} index={index}>
                  {(isDragging) => (
                    <CardTrabalho
                      item={item}
                      isDragging={isDragging}
                      onAbrir={onAbrir}
                      onPrioridade={onPrioridade}
                      onExcluir={onExcluir}
                    />
                  )}
                </KanbanDraggable>
              ))}
            </KanbanColumn>
          );
        })}

        <AddColumnInline
          colors={CORES_ETAPA}
          busy={etapaControls.criando}
          onCreate={(nome, cor) => etapaControls.onCriar(nome, cor)}
          triggerClassName={KANBAN_ADD_COLUMN_CLASSES.trigger}
          panelClassName={KANBAN_ADD_COLUMN_CLASSES.panel}
        />
      </div>
    </DragDropContext>
  );
}
