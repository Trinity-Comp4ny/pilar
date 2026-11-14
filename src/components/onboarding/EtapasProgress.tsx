import { cn } from "@/lib/utils";

interface EtapasProgressProps {
  /** Etapa atual, de 1 a `rotulos.length`. */
  etapa: number;
  /** Nome curto de cada etapa, na ordem. O total vem do tamanho da lista. */
  rotulos: string[];
  className?: string;
}

/**
 * Barra de etapas do cadastro e do onboarding (SPEC 165): "Etapa N de M", o nome
 * da etapa e uma barra segmentada que enche com transição. Cada segmento tem
 * três estados: feito, atual e por fazer. Uma barra só atravessa as telas, para
 * a pessoa saber quanto falta.
 */
export function EtapasProgress({ etapa, rotulos, className }: EtapasProgressProps) {
  const total = rotulos.length;
  const atual = Math.min(Math.max(etapa, 1), total);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink">{rotulos[atual - 1]}</span>
        <span className="text-ink-soft">
          Etapa {atual} de {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Etapas do cadastro"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={atual}
        aria-valuetext={`Etapa ${atual} de ${total}: ${rotulos[atual - 1]}`}
        className="flex gap-1.5"
      >
        {rotulos.map((rotulo, i) => {
          const numero = i + 1;
          const feita = numero < atual;
          const ativa = numero === atual;
          return (
            <div key={rotulo} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-paper-border">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full bg-gradient-brand transition-[width] duration-700 ease-out motion-reduce:transition-none",
                  feita ? "w-full" : ativa ? "w-1/2" : "w-0"
                )}
              />
            </div>
          );
        })}
      </div>
      <ol className="sr-only">
        {rotulos.map((rotulo, i) => (
          <li key={rotulo}>
            {rotulo}
            {i + 1 < atual ? " (concluída)" : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}
