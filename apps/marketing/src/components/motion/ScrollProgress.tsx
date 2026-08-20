import { m, useReducedMotion, useScroll, useSpring } from "framer-motion";

/**
 * Fio de progresso de leitura, colado embaixo do header. É a única indicação
 * de "onde eu estou" numa página longa sem índice.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reducedMotion = useReducedMotion();
  const escala = useSpring(scrollYProgress, { stiffness: 160, damping: 32, restDelta: 0.001 });

  if (reducedMotion) return null;

  return (
    <m.div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[2px] bg-brand origin-left z-50"
      style={{ scaleX: escala }}
    />
  );
}
