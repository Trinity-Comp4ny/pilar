import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

interface NumberTickerProps {
  value: number;
  /** Casas decimais. Dinheiro costuma ser 0 aqui, a fração vive no sufixo. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}

const formatador = (decimals: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Mesma expo-out do resto do vocabulário de movimento, em forma escalar. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Número que conta até o valor quando entra em vista.
 *
 * Roda num `requestAnimationFrame` próprio em vez do `animate()` do
 * framer-motion: o `animate` imperativo arrasta o motor de animação inteiro
 * para o bundle inicial, e aqui o trabalho é interpolar um escalar.
 *
 * Escreve direto no `textContent`, sem estado React: são ~60 atualizações por
 * segundo, e re-renderizar a árvore a cada quadro por causa de um número seria
 * desperdício.
 */
export function NumberTicker({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
  delay = 0,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const emVista = useInView(ref, { once: true, amount: 0.5 });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const alvo = ref.current;
    if (!alvo) return;

    const fmt = formatador(decimals);
    const escrever = (n: number) => {
      alvo.textContent = `${prefix}${fmt.format(n)}${suffix}`;
    };

    if (reducedMotion) {
      escrever(value);
      return;
    }
    if (!emVista) {
      escrever(0);
      return;
    }

    let raf = 0;
    let inicio = 0;
    const ms = duration * 1000;

    const passo = (agora: number) => {
      if (!inicio) inicio = agora;
      const t = Math.min(1, (agora - inicio) / ms);
      escrever(value * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(passo);
    };

    const id = window.setTimeout(() => {
      raf = requestAnimationFrame(passo);
    }, delay * 1000);

    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [emVista, value, decimals, prefix, suffix, duration, delay, reducedMotion]);

  return (
    <span ref={ref} className={className}>
      {/* Conteúdo inicial serve de equivalente para leitor de tela e para no-JS. */}
      {`${prefix}${formatador(decimals).format(value)}${suffix}`}
    </span>
  );
}
