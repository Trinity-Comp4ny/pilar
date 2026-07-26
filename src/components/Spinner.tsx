import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spinner padrão (ADR 0008, spec 003 onda 2) — substitui os Loader2/animate-spin
 * ad-hoc. Com `label`, anuncia o carregamento para leitores de tela.
 */
const SIZES = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" } as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  /** Texto ao lado do spinner (ex.: "Carregando projetos"). */
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2 text-black/50", className)}>
      <Loader2 aria-hidden className={cn("animate-spin motion-reduce:animate-none", SIZES[size])} />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Carregando</span>}
    </span>
  );
}
