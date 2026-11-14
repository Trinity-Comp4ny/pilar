/**
 * Regras puras do "puxe para atualizar" (celular). Ficam fora do componente para
 * serem testadas sem DOM de toque.
 */

/** Distância (px de dedo, já amortecida) a partir da qual soltar dispara a atualização. */
export const LIMIAR_PUXAR = 72;
/** Máximo que o indicador desce, por mais que o dedo continue. */
export const MAXIMO_PUXAR = 120;
/** Onde o indicador fica parado enquanto atualiza. */
export const POSICAO_ATUALIZANDO = 56;
/** Tempo mínimo visível do indicador: refetch em cache some rápido demais para a pessoa perceber. */
export const MINIMO_ATUALIZANDO_MS = 700;

/** Amortece o dedo: puxa fácil no começo e fica pesado perto do máximo (resistência de borracha). */
export function amortecer(dy: number): number {
  if (dy <= 0) return 0;
  const resistido = dy * 0.5;
  return Math.min(MAXIMO_PUXAR, resistido);
}

export function progressoDoPuxar(distancia: number): number {
  return Math.max(0, Math.min(1, distancia / LIMIAR_PUXAR));
}

interface IniciarArgs {
  /** `window.scrollY` no começo do toque. */
  scrollY: number;
  /** Há diálogo, sheet ou menu aberto por cima da página. */
  sobreposicaoAberta: boolean;
  /** O toque nasceu em área que rola, arrasta ou digita por conta própria. */
  alvoProprio: boolean;
}

/** Só puxa a página quando ela está no topo e nada por cima/ao redor quer o gesto. */
export function podeIniciarPuxar({ scrollY, sobreposicaoAberta, alvoProprio }: IniciarArgs): boolean {
  return scrollY <= 0 && !sobreposicaoAberta && !alvoProprio;
}

const SELETOR_PROPRIO =
  "input, textarea, select, [contenteditable=true], [data-no-ptr], .leaflet-container, [data-dnd-kit], [role=slider]";

/** O toque começou em algo que trata o gesto sozinho: mapa, campo de texto, arraste, área rolável interna. */
export function alvoTratoGestoProprio(alvo: EventTarget | null, getComputedStyleFn = window.getComputedStyle): boolean {
  if (!(alvo instanceof Element)) return false;
  if (alvo.closest(SELETOR_PROPRIO)) return true;
  // Ancestral que rola (vertical, ou horizontal: carrossel/kanban) e tem conteúdo a mais.
  let el: Element | null = alvo;
  while (el && el !== document.body && el !== document.documentElement) {
    const estilo = getComputedStyleFn(el);
    const rolaY = /(auto|scroll)/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight;
    const rolaX = /(auto|scroll)/.test(estilo.overflowX) && el.scrollWidth > el.clientWidth;
    if (rolaY || rolaX) return true;
    el = el.parentElement;
  }
  return false;
}

export const SELETOR_SOBREPOSICAO = '[role="dialog"], [role="alertdialog"], [role="menu"], [data-vaul-drawer]';
