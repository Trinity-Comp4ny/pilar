// Medidas únicas dos quadros Kanban (SPEC 122).
/** Container do quadro: colunas lado a lado, rolagem horizontal. */
export const KANBAN_BOARD_CLASS = "flex h-full min-h-0 w-full gap-3 overflow-x-auto pb-2";

/** Largura única da coluna, e do botão/painel "Nova coluna" que acompanha. */
export const KANBAN_COLUMN_WIDTH = "w-[280px]";

/** Alinha o "Nova coluna" com o início da superfície das colunas (altura do cabeçalho). */
export const KANBAN_ADD_COLUMN_CLASSES = {
  trigger: `mt-10 ${KANBAN_COLUMN_WIDTH} rounded-xl`,
  panel: `mt-10 ${KANBAN_COLUMN_WIDTH} self-start rounded-xl p-2.5`,
};
