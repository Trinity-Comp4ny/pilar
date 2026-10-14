import { BusyMark } from "@/components/motion/BusyMark";
import { cn } from "@/lib/utils";

/**
 * Espera inline com texto (ADR 0008, ADR 0049): o ritmo da marca ao lado do que
 * está carregando. Para página, seção ou card, use `PageLoader`.
 */
const SIZES = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" } as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  /** Texto ao lado (ex.: "Carregando projetos"). */
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2 text-ink-muted", className)}>
      <BusyMark className={SIZES[size]} />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Carregando</span>}
    </span>
  );
}
