import { PilarMark } from "./PilarMark";

/**
 * Espera inline (ritmo, ADR 0049): no lugar de todo spinner pequeno, dentro de
 * botão, campo ou linha de status. Herda a cor do texto e é decorativa: quem
 * anuncia a espera é o texto ao lado ou o `aria-busy` do controle.
 */
export function BusyMark({ className = "" }: { className?: string }) {
  return <PilarMark variant="rhythm" weight={2.6} className={`busy-mark ${className}`} />;
}
