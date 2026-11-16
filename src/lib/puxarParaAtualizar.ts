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

/** Tolerância (px) para "está no topo": o iOS repousa em frações (0,33) e com sobra de borracha. */
export const TOLERANCIA_TOPO = 2;

type AlvoDoToque =
  /** Algo que trata o gesto sozinho (campo, mapa, arraste, carrossel horizontal). */
  | "proprio"
  /** Quem rola (a janela ou o contêiner interno da página) não está no topo. */
  | "rolado"
  /** Quem rola está no topo: pode puxar. */
  | "topo";

interface ClassificacaoDoToque {
  tipo: AlvoDoToque;
  /** Contêiner que rola a página sob o dedo; `null` = a própria janela. */
  rolavel: Element | null;
}

/**
 * Onde o toque começou e se dá para puxar. Nas telas principais a página rola DENTRO de um painel
 * fixo (PageLayout: `fixed` + `overflow-y-auto`), não na janela: `window.scrollY` ali é sempre 0.
 * Por isso o que vale é o `scrollTop` do primeiro ancestral que rola na vertical; só sem ele a
 * janela decide. Ancestral que rola na horizontal (chips, kanban, tabela larga) é gesto próprio.
 */
export function classificarToque(
  alvo: EventTarget | null,
  getComputedStyleFn: (el: Element) => CSSStyleDeclaration = (el) => window.getComputedStyle(el),
  scrollYJanela: number = typeof window === "undefined" ? 0 : window.scrollY
): ClassificacaoDoToque {
  if (!(alvo instanceof Element)) return { tipo: scrollYJanela > TOLERANCIA_TOPO ? "rolado" : "topo", rolavel: null };
  if (alvo.closest(SELETOR_PROPRIO)) return { tipo: "proprio", rolavel: null };

  let el: Element | null = alvo;
  while (el && el !== document.body && el !== document.documentElement) {
    const estilo = getComputedStyleFn(el);
    if (/(auto|scroll)/.test(estilo.overflowX) && el.scrollWidth > el.clientWidth + 1) {
      return { tipo: "proprio", rolavel: null };
    }
    if (/(auto|scroll)/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      return { tipo: el.scrollTop > TOLERANCIA_TOPO ? "rolado" : "topo", rolavel: el };
    }
    el = el.parentElement;
  }
  return { tipo: scrollYJanela > TOLERANCIA_TOPO ? "rolado" : "topo", rolavel: null };
}

/** O que rola a página (contêiner interno ou janela) ainda está no topo? */
export function estaNoTopo(rolavel: Element | null, scrollYJanela: number = window.scrollY): boolean {
  return (rolavel ? rolavel.scrollTop : scrollYJanela) <= TOLERANCIA_TOPO;
}

interface IniciarArgs {
  tipoDoToque: AlvoDoToque;
  /** Há diálogo, sheet ou menu aberto por cima da página. */
  sobreposicaoAberta: boolean;
}

/** Só puxa quando quem rola está no topo e nada por cima/ao redor quer o gesto. */
export function podeIniciarPuxar({ tipoDoToque, sobreposicaoAberta }: IniciarArgs): boolean {
  return tipoDoToque === "topo" && !sobreposicaoAberta;
}

const SELETOR_PROPRIO =
  "input, textarea, select, [contenteditable=true], [data-no-ptr], .leaflet-container, [data-dnd-kit], [role=slider]";

export const SELETOR_SOBREPOSICAO = '[role="dialog"], [role="alertdialog"], [role="menu"], [data-vaul-drawer]';
