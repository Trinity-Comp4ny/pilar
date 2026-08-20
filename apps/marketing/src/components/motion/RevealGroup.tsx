import type { ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { REVEAL, VIEWPORT, revealTransition, staggerContainer, type RevealVariant } from "../../lib/motion";

interface RevealGroupProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

/**
 * Container que escalona a entrada dos filhos. Use `RevealGroup.Item` nos filhos
 * diretos: a cascata sai do container, então um item não precisa saber a própria
 * posição nem carregar um `delay` calculado à mão.
 */
export function RevealGroup({ children, className, stagger = 0.08, delay = 0 }: RevealGroupProps) {
  const reducedMotion = useReducedMotion();

  return (
    <m.div
      className={className}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={VIEWPORT}
      variants={staggerContainer(reducedMotion ? 0 : stagger, delay)}
    >
      {children}
    </m.div>
  );
}

interface ItemProps {
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  duration?: number;
}

function Item({ children, className, variant = "up", duration }: ItemProps) {
  return (
    <m.div className={className} variants={REVEAL[variant]} transition={revealTransition(duration)}>
      {children}
    </m.div>
  );
}

RevealGroup.Item = Item;
