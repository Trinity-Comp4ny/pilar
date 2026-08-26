import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { EASE } from "../lib/motion";

/**
 * Verbo que gira dentro do H1.
 *
 * A palavra sai por cima e a próxima entra por baixo, dentro de uma janela que
 * corta o transbordo, e a largura da janela anima junto para o resto da frase
 * acompanhar sem salto. Um espelho invisível mede a palavra na tipografia real
 * antes da troca, então a largura nunca é chute.
 *
 * Substitui a antiga pílula colorida (RotatingPill): no arranjo novo o destaque
 * é o itálico verde do título, e uma pílula ali competiria com ele.
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

  // Mede antes da pintura: a largura inicial não pode "pular" no primeiro quadro.
  useLayoutEffect(() => {
    const el = espelho.current;
    if (!el) return;
    // `scrollWidth` junto com o rect porque a caixa de um itálico não contém a
    // barriga da última letra: medindo só pelo rect, a janela corta o "m" final.
    // O respiro extra é proporcional ao corpo da fonte, então vale em qualquer
    // tamanho do clamp.
    const corpo = parseFloat(getComputedStyle(el).fontSize) || 16;
    setLargura(Math.max(el.scrollWidth, el.getBoundingClientRect().width) + corpo * 0.09);
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
      className="relative inline-flex overflow-hidden align-bottom pb-[0.1em] -mb-[0.1em]"
      animate={{ width: largura ? Math.ceil(largura) : undefined }}
      transition={{ duration: 0.42, ease: EASE.out }}
      style={{ width: largura ? Math.ceil(largura) : undefined }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={atual}
          className="italic text-modulo-gestao-strong whitespace-nowrap"
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
