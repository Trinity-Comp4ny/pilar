import { useEffect, useRef, useState } from "react";
import { PilarMark } from "./PilarMark";
import { startReadingRing } from "./readingRingEngine";

/** Espera curta não anima (SPEC 106): o anel só aparece depois disso. */
export const RING_DELAY_MS = 300;

interface ReadingRingProps {
  /** Lado do quadrado em px. A marca no centro ocupa ~27% dele. */
  size?: number;
  /** Atraso antes de aparecer; 0 mostra na hora (boot, véu). */
  delay?: number;
  className?: string;
}

const markWeight = (size: number) => (size < 50 ? 2.6 : size < 100 ? 1.9 : 1.6);

/**
 * Anel de leitura (R1, ADR 0049): o carregamento do Pilar para página, seção e
 * card. Decorativo; quem anuncia a espera é o `role="status"` de quem o usa
 * (ver PageLoader). Reserva o espaço desde o primeiro render, então a tela não
 * pula quando o anel aparece.
 */
export function ReadingRing({ size = 96, delay = RING_DELAY_MS, className = "" }: ReadingRingProps) {
  const [visible, setVisible] = useState(delay <= 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (delay <= 0) return;
    const id = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const ring = startReadingRing(canvasRef.current);
    return ring.stop;
  }, [visible]);

  return (
    <span
      aria-hidden="true"
      data-testid="reading-ring"
      data-visible={visible}
      className={`reading-ring ${visible ? "is-visible" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      {visible && (
        <>
          <canvas ref={canvasRef} />
          <PilarMark
            variant="rhythm"
            weight={markWeight(size)}
            className="reading-ring__mark"
            style={{ width: Math.round(size * 0.27) }}
          />
        </>
      )}
    </span>
  );
}
