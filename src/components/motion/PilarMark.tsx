import type { CSSProperties } from "react";

// A marca são seis linhas num box de 28x25: capitel, ábaco e quatro caneluras.
const CANELURAS = [7, 12, 17, 22];

type PilarMarkVariant = "static" | "rhythm" | "draw";

interface PilarMarkProps {
  /** "rhythm": espera (ADR 0049). "draw": traço técnico, uma vez. */
  variant?: PilarMarkVariant;
  /** Espessura do traço no box da marca; marca pequena pede traço mais grosso. */
  weight?: number;
  /** Com título, a marca vira imagem acessível; sem, é decorativa. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A coluna do Pilar em SVG, na cor do texto ao redor. Animação só por classe
 * (src/styles/motion.css): zero JavaScript por frame, e movimento reduzido cai no
 * quadro final.
 */
export function PilarMark({ variant = "static", weight = 1.6, title, className = "", style }: PilarMarkProps) {
  // No desenho as caneluras descem do ábaco; no ritmo elas crescem da base.
  const fromTop = variant === "draw";
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true, focusable: false };

  return (
    <svg
      viewBox="-1 -0.5 30 25.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      className={`pilar-mark pilar-mark--${variant} ${className}`}
      style={style}
      {...a11y}
    >
      <path className="pm-cap" pathLength={1} d="M1 2H27" />
      <path className="pm-aba" pathLength={1} d="M3 6H25" strokeOpacity={0.85} />
      {CANELURAS.map((x, i) => (
        <path key={x} className={`pm-fl pm-f${i + 1}`} pathLength={1} d={fromTop ? `M${x} 9V23` : `M${x} 23V9`} />
      ))}
    </svg>
  );
}
