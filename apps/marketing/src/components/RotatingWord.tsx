import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { EASE } from "../lib/motion";

/**
 * Verbo que gira dentro do H1, sobre o verde da marca.
 *
 * O verde `#A4EC86` só pode aparecer como fundo com tinta escura por cima
 * (regra da marca), então a palavra vem em pílula verde com texto ink, e não
 * pintada de verde. A pílula sai por cima e a próxima entra por baixo, dentro
 * de uma janela que corta o transbordo, e a largura anima junto para o resto da
 * frase acompanhar sem salto.
 *
 * A largura vem de um espelho invisível medido na tipografia real, somada a uma
 * fatia proporcional ao corpo da fonte: a caixa de um itálico não contém a
 * barriga da última letra, e medir só pelo rect cortava o "m" final.
 */

interface RotatingWordProps {
  palavras: string[];
  intervalMs?: number;
  /** Espera antes de começar a girar, para casar com a entrada do título. */
  atraso?: number;
}

export function RotatingWord({ palavras, intervalMs = 2600, atraso = 0 }: RotatingWordProps) {
  const [i, setI] = useState(0);
  const [largura, setLargura] = useState<number>();
  const espelho = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  const atual = palavras[i];

  useLayoutEffect(() => {
    const el = espelho.current;
    if (!el) return;
    const corpo = parseFloat(getComputedStyle(el).fontSize) || 16;
    // 0.12em para a barriga do itálico, que o rect não mede, mais os 0.32em de
    // respiro da pílula: como a caixa é `border-box`, o padding entra na
    // largura e comeria a última letra se não fosse somado aqui.
    setLargura(Math.max(el.scrollWidth, el.getBoundingClientRect().width) + corpo * 0.44);
  }, [atual]);

  useEffect(() => {
    if (reducedMotion || palavras.length < 2) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setI((n) => (n + 1) % palavras.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [reducedMotion, palavras.length, intervalMs]);

  return (
    <m.span
      className="relative inline-flex overflow-hidden rounded-[0.28em] bg-brand align-baseline px-[0.16em]"
      animate={{ width: largura ? Math.ceil(largura) : undefined }}
      transition={{ duration: 0.42, ease: EASE.out }}
      style={{ width: largura ? Math.ceil(largura) : undefined }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={atual}
          className="italic text-ink whitespace-nowrap"
          initial={reducedMotion ? false : { y: "-105%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={reducedMotion ? undefined : { y: "105%", opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE.out, delay: atraso }}
        >
          {atual}
        </m.span>
      </AnimatePresence>

      {/* Espelho fora de fluxo: mede a palavra na tipografia real. */}
      <span
        ref={espelho}
        aria-hidden="true"
        className="absolute -left-[9999px] italic whitespace-nowrap pointer-events-none"
      >
        {atual}
      </span>
    </m.span>
  );
}
