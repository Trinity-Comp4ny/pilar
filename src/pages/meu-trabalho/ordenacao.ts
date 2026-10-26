import type { KanbanSort, KanbanSortAccessors, KanbanSortKey } from "@/lib/kanbanSort";
import { PRIORIDADE_ORDER } from "./status";
import type { ItemTrabalho } from "./useItensTrabalho";

/** Chaves de ordenação que o quadro de Tarefas sabe aplicar (sem valor em R$). */
export const TAREFAS_SORT_KEYS: readonly KanbanSortKey[] = ["priority", "dueDate", "name", "created"];
export const TAREFAS_SORT_PADRAO: KanbanSort = { key: "dueDate", dir: "asc" };

export const TAREFAS_SORT_ACESSORES: KanbanSortAccessors<ItemTrabalho> = {
  priority: (i) => PRIORIDADE_ORDER.indexOf(i.prioridade),
  dueDate: (i) => i.prazo,
  name: (i) => i.titulo,
  // Só a tarefa tem número sequencial; disciplina vai para o fim.
  created: (i) => i.numero,
};
