/**
 * Larguras da navegação desktop: trilho fixo de módulos (sempre visível) + painel
 * com os itens do módulo ativo (recolhível). Fonte única pra quem posiciona
 * conteúdo ao lado da sidebar (Layout, PageLayout, telas `fixed`).
 */
export const RAIL_WIDTH = 64;
export const PANEL_WIDTH = 208;

/**
 * Abaixo desta largura (notebook 13"), o painel começa recolhido e, recolhido, abre por cima
 * do conteúdo em vez de empurrá-lo: 208 px valem uma coluna de Kanban (auditoria de espaço,
 * 2026-11). A escolha salva da pessoa (cookie) sempre vence.
 */
export const LARGURA_PAINEL_FIXO = 1536;

export function telaEstreitaParaPainel(): boolean {
  return typeof window !== "undefined" && window.innerWidth < LARGURA_PAINEL_FIXO;
}

/** Deslocamento à esquerda do conteúdo, em px. Mobile não tem sidebar. */
export function sidebarOffset(state: "expanded" | "collapsed", isMobile: boolean): number {
  if (isMobile) return 0;
  return state === "collapsed" ? RAIL_WIDTH : RAIL_WIDTH + PANEL_WIDTH;
}

/**
 * `containerClassName` das telas de dados: a altura da tela (e a rolagem por dentro) só vale
 * a partir de md. No celular a página rola inteira e o fim fica acima da barra de baixo;
 * prender a altura fazia o conteúdo parar antes da barra (feedback do dono, 14/11).
 */
export const CONTAINER_TELA_DADOS = "md:flex md:h-full md:min-h-0 md:flex-col";
