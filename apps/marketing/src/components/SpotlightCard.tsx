import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { useReducedMotion } from "framer-motion";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** Cor do brilho em hsla/rgba (não dá pra usar classe Tailwind num gradient inline). */
  glow?: string;
}

/**
 * Card com um brilho radial que segue o cursor, no padrão "Spotlight Card"
 * (reactbits/cult-ui). Some no touch (não há hover) e desliga com
 * prefers-reduced-motion, caindo pro estado estático do `className`.
 */
export function SpotlightCard({ children, className = "", glow = "hsla(102, 73%, 60%, 0.28)" }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [ativo, setAtivo] = useState(false);
  const reducedMotion = useReducedMotion();

  const mover = (e: MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={mover}
      onMouseEnter={() => setAtivo(true)}
      onMouseLeave={() => setAtivo(false)}
      className={`relative isolate overflow-hidden ${className}`}
    >
      {!reducedMotion && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300 ${ativo ? "opacity-100" : "opacity-0"}`}
          style={{ background: `radial-gradient(260px circle at ${pos.x}% ${pos.y}%, ${glow}, transparent 72%)` }}
        />
      )}
      {children}
    </div>
  );
}
