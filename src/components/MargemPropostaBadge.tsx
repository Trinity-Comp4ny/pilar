import { cn } from "@/lib/utils";
import { resumoMargemProposta } from "@/lib/margemProposta";

const CLASSE = {
  verde: "bg-positive/10 text-positive-strong",
  amarelo: "bg-warning-soft text-warning-strong",
  vermelho: "bg-danger-soft text-danger-strong",
} as const;

interface MargemPropostaBadgeProps {
  dadosSimulacao: unknown;
  className?: string;
}

/** Margem líquida que a proposta prometeu, com o semáforo da calculadora (SPEC 168). */
export function MargemPropostaBadge({ dadosSimulacao, className }: MargemPropostaBadgeProps) {
  const r = resumoMargemProposta(dadosSimulacao);
  if (!r) return null;
  return (
    <span
      className={cn("rounded px-1.5 py-0.5 text-2xs font-medium tabular-nums", CLASSE[r.semaforo], className)}
      title={`Margem líquida depois de imposto e taxa. Alvo: ${r.alvoPct.toFixed(0)}%`}
      data-testid="margem-proposta-badge"
    >
      {r.margemPct.toFixed(0)}% líquida
    </span>
  );
}
