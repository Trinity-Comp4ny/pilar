import { useRef, type ReactNode } from "react";
import { m, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

interface ParallaxProps {
  children: ReactNode;
  /** Deslocamento total em px ao longo da travessia. Negativo sobe. */
  distance?: number;
  className?: string;
}

/**
 * Deslocamento acoplado ao scroll. É o que faz camadas diferentes andarem em
 * velocidades diferentes, e é a peça que faltava para a página parecer ter
 * profundidade em vez de blocos que só aparecem (SPEC 072).
 */
export function Parallax({ children, distance = -60, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bruto = useTransform(scrollYProgress, [0, 1], [0, distance]);
  const y = useSpring(bruto, { stiffness: 120, damping: 28, mass: 0.6 });

  if (reducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <m.div ref={ref} className={className} style={{ y }}>
      {children}
    </m.div>
  );
}

/**
 * Escala e opacidade acopladas ao scroll: o bloco "assenta" conforme sobe pela
 * tela. Usado no painel da hero, que começa levemente afastado e chega ao 1:1.
 */
export function ScrollSettle({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "start 0.25"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0.55, 1]);

  if (reducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <m.div ref={ref} className={className} style={{ scale, opacity, transformOrigin: "top center" }}>
      {children}
    </m.div>
  );
}
