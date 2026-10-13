/**
 * Larguras da navegação desktop: trilho fixo de módulos (sempre visível) + painel
 * com os itens do módulo ativo (recolhível). Fonte única pra quem posiciona
 * conteúdo ao lado da sidebar (Layout, PageLayout, telas `fixed`).
 */
export const RAIL_WIDTH = 64;
export const PANEL_WIDTH = 208;

/** Deslocamento à esquerda do conteúdo, em px. Mobile não tem sidebar. */
export function sidebarOffset(state: "expanded" | "collapsed", isMobile: boolean): number {
  if (isMobile) return 0;
  return state === "collapsed" ? RAIL_WIDTH : RAIL_WIDTH + PANEL_WIDTH;
}
