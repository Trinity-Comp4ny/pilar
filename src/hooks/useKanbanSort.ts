import { useState } from "react";
import { formatKanbanSort, parseKanbanSort, type KanbanSort, type KanbanSortKey } from "@/lib/kanbanSort";

/**
 * Ordenação do quadro lembrada por navegador (um `storageKey` por tela). Chave
 * que a tela não suporta (guardada por engano ou por versão antiga) volta ao padrão.
 */
export function useKanbanSort(storageKey: string, fallback: KanbanSort, supported: readonly KanbanSortKey[]) {
  const chave = `pilar.kanban-sort.${storageKey}`;
  const [sort, setSortState] = useState<KanbanSort>(() => {
    try {
      const lido = parseKanbanSort(localStorage.getItem(chave), fallback);
      return supported.includes(lido.key) ? lido : fallback;
    } catch {
      return fallback;
    }
  });

  const setSort = (next: KanbanSort) => {
    setSortState(next);
    try {
      localStorage.setItem(chave, formatKanbanSort(next));
    } catch {
      // localStorage indisponível (modo privado): sem persistência, sem erro.
    }
  };

  return [sort, setSort] as const;
}
