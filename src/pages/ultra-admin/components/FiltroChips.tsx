import { cn } from "@/lib/utils";

export type OpcaoChip<T extends string> = { value: T; label: string; count?: number };

/** Filtro de uma escolha em chips com contagem, usado nas listas do portal ultra admin. */
export function FiltroChips<T extends string>({
  opcoes,
  value,
  onChange,
  ariaLabel,
}: {
  opcoes: OpcaoChip<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1.5 max-md:-mx-6 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-6 max-md:pb-0.5 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
    >
      {opcoes.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors max-md:h-9 max-md:text-[13px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10",
              ativo
                ? "border-transparent bg-ink font-medium text-background"
                : "border-black/10 bg-background text-ink-soft hover:border-black/20 hover:text-ink"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tabular-nums", ativo ? "text-background/70" : "text-ink-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
