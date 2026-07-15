// Tipos e rótulos da ordenação global do quadro de Projetos.
// Compartilhados entre o estado de URL (useProjetosUrlState) e o
// controle visível de ordenação (SortControl).
export type SortKey = "priority" | "dueDate" | "value" | "name" | "created";
export type SortDir = "asc" | "desc";

export const SORT_LABELS: Record<SortKey, string> = {
  priority: "Prioridade",
  dueDate: "Previsão",
  value: "Valor",
  name: "Nome",
  created: "Criação",
};
