import { PROJECT_STATUS } from "@/constants";

// Cor do "dot" de cada status, usada no cabeçalho das colunas do quadro
// (desktop e mobile). Fonte única para as duas visualizações.
export const STATUS_DOT: Record<string, string> = {
  [PROJECT_STATUS.PLANEJAMENTO]: "bg-status-planning",
  [PROJECT_STATUS.EM_ANDAMENTO]: "bg-status-progress",
  [PROJECT_STATUS.REVISAO]: "bg-status-review",
  [PROJECT_STATUS.PARALISADO]: "bg-brand",
  [PROJECT_STATUS.CONCLUIDO]: "bg-status-done",
  [PROJECT_STATUS.CANCELADO]: "bg-status-cancelled",
};
