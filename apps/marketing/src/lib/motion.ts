/**
 * Vocabulário de movimento da landing.
 *
 * Antes existia uma animação só na LP inteira (fade + y, 700ms, em tudo), o que
 * deixava a página com um ritmo único e sem hierarquia. Aqui ficam as durações,
 * curvas e variantes compartilhadas, para que cada seção escolha uma coreografia
 * diferente das vizinhas sem cada uma reinventar números (ver SPEC 060).
 *
 * Nenhuma dependência nova: os padrões são adaptados à mão sobre o
 * `framer-motion` que já está instalado, mesmo caminho do `ModuleConnector`.
 */

import type { Transition, Variants } from "framer-motion";

/** Curvas. `out` é a expo-out de produto: entrada rápida, freio longo. */
export const EASE = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  soft: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
};

export const DUR = {
  fast: 0.32,
  base: 0.6,
  slow: 0.9,
  scene: 1.2,
};

/** Mola de elementos que "assentam": cursor da hero, card que voa entre colunas. */
export const SPRING: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 };

/**
 * Viewport padrão dos reveals. `amount: 0.15` dispara com um pedaço pequeno já
 * visível, e a margem negativa atrasa um tico para o elemento não animar colado
 * na borda inferior. `once` evita re-animar no scroll de volta.
 */
export const VIEWPORT = { once: true, amount: 0.15, margin: "0px 0px -8% 0px" } as const;

/** Viewport de blocos altos, que nunca cabem inteiros na tela. */
export const VIEWPORT_LOOSE = { once: true, amount: 0.05, margin: "0px 0px -4% 0px" } as const;

export type RevealVariant = "up" | "down" | "left" | "right" | "blur" | "mask" | "scale" | "fade";

/**
 * Variantes de entrada. Todas convergem para o mesmo estado final, então dá para
 * misturar variantes diferentes na mesma grade sem desalinhar nada.
 */
export const REVEAL: Record<RevealVariant, Variants> = {
  up: { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } },
  down: { hidden: { opacity: 0, y: -22 }, visible: { opacity: 1, y: 0 } },
  left: { hidden: { opacity: 0, x: -32 }, visible: { opacity: 1, x: 0 } },
  right: { hidden: { opacity: 0, x: 32 }, visible: { opacity: 1, x: 0 } },
  blur: {
    hidden: { opacity: 0, y: 16, filter: "blur(12px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
  mask: {
    hidden: { opacity: 0, clipPath: "inset(0 0 100% 0)" },
    visible: { opacity: 1, clipPath: "inset(0 0 0% 0)" },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.94, y: 18 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
};

/** Container que escalona os filhos. Use junto com `staggerItem` nos filhos diretos. */
export function staggerContainer(stagger = 0.07, delayChildren = 0): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren } } };
}

export const staggerItem: Variants = REVEAL.up;

export function revealTransition(duration = DUR.base, delay = 0): Transition {
  return { duration, delay, ease: EASE.out };
}
