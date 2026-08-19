import type { ReactNode } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";

const variants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

interface RevealProps {
  children?: ReactNode;
  delay?: number;
  className?: string;
}

/** Substitui a antiga classe `reveal-up` + IntersectionObserver manual (ver ADR 0023). */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <m.div
      className={className}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -10% 0px", amount: 0.1 }}
      variants={variants}
      transition={{ duration: 0.7, ease: "easeOut", delay: reducedMotion ? 0 : delay }}
    >
      {children}
    </m.div>
  );
}
