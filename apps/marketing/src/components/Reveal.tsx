import type { ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { REVEAL, VIEWPORT, VIEWPORT_LOOSE, revealTransition, type RevealVariant } from "../lib/motion";

interface RevealProps {
  children?: ReactNode;
  /** Coreografia de entrada. Cada seção da home usa uma diferente (SPEC 072). */
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  /** Blocos altos, que nunca cabem inteiros na tela, disparam mais cedo. */
  loose?: boolean;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}

/**
 * Reveal on scroll. Substitui a antiga classe `reveal-up` + IntersectionObserver
 * manual (ver ADR 0023), e desde a SPEC 072 aceita variante: antes era só
 * fade + y em toda a landing, o que deixava a página com um ritmo só.
 */
export function Reveal({
  children,
  variant = "up",
  delay = 0,
  duration,
  loose = false,
  className,
  as = "div",
}: RevealProps) {
  const reducedMotion = useReducedMotion();
  const Tag = m[as];

  return (
    <Tag
      className={className}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={loose ? VIEWPORT_LOOSE : VIEWPORT}
      variants={REVEAL[variant]}
      transition={revealTransition(duration, reducedMotion ? 0 : delay)}
    >
      {children}
    </Tag>
  );
}
