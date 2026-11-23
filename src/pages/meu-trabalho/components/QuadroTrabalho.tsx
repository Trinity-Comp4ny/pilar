import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { AddColumnInline } from "@/components/kanban/AddColumnInline";
import { KANBAN_ADD_COLUMN_CLASSES, KANBAN_BOARD_CLASS } from "@/components/kanban/kanbanLayout";
import { KanbanColumn, KanbanDraggable } from "@/components/kanban/KanbanColumn";
import { KanbanMobile } from "@/components/kanban/KanbanMobile";
import { useIsMobile } from "@/hooks/use-mobile";
import { ordenarKanban, type KanbanSort } from "@/lib/kanbanSort";
import { TAREFAS_SORT_ACESSORES } from "../ordenacao";
import { agruparPorEtapa, type ItemTrabalho } from "../useItensTrabalho";
import type { Etapa } from "@/hooks/tarefas/useEtapas";
import { corDaEtapa, CORES_ETAPA, type Prioridade } from "@/lib/tarefas/status";
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
  /** "Adicionar tarefa" no fim da coluna: abre o formulário já nela. */
  onCriarNoGrupo?: (etapaId: string) => void;
  etapaControls: EtapaControls;
};

const LS_RECOLHIDAS = "pilar.meu-trabalho.quadro-recolhidas";

function lerRecolhidas(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_RECOLHIDAS) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function QuadroTrabalho({
  itens,
  sort,
  onAbrir,
  onPrioridade,
  onExcluir,
  onMover,
  onCriarNoGrupo,
  etapaControls,
}: Props) {
  const { etapas } = etapaControls;
  const isMobile = useIsMobile();
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => lerRecolhidas());
  const alternarRecolhida = useCallback((id: string) => {
    setRecolhidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(LS_RECOLHIDAS, JSON.stringify([...next]));
      } catch {
        // sem persistência, sem erro.
      }
      return next;
    });
  }, []);
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

  // Celular: colunas que passam com o dedo, sem arraste; mover é pelo menu do card.
  if (isMobile) {
    return (
      <KanbanMobile
        ariaLabel="Quadro de tarefas"
        colunas={grupos.map((grupo) => {
          const etapa = etapas.find((e) => e.id === grupo.chave);
          return {
            id: grupo.chave,
            titulo: grupo.titulo,
            cor: corDaEtapa(etapa?.cor ?? null, etapa?.bucket ?? null),
            quantidade: grupo.itens.length,
            children: grupo.itens.map((item) => (
              <CardTrabalho
                key={item.key}
                item={item}
                onAbrir={onAbrir}
                onPrioridade={onPrioridade}
                onExcluir={onExcluir}
                etapas={etapas}
                etapaAtualId={grupo.chave}
                onMover={onMover}
              />
            )),
          };
        })}
      />
    );
  }

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
              collapsed={recolhidas.has(grupo.chave)}
              onCollapse={() => alternarRecolhida(grupo.chave)}
              footer={
                onCriarNoGrupo && (
                  <button
                    type="button"
                    onClick={() => onCriarNoGrupo(grupo.chave)}
                    className="flex h-8 w-full items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    aria-label={`Adicionar tarefa em ${grupo.titulo}`}
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
                  </button>
                )
              }
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
