import { cn } from "@/lib/utils";

interface ColumnColorPickerProps {
  /** Paleta da coluna (swatches). */
  colors: readonly string[];
  value: string;
  onChange: (cor: string) => void;
  className?: string;
}

/**
 * Swatches de cor da coluna do quadro. Compartilhado pela criação inline
 * (AddColumnInline) e pela edição (EditColumnDialog). Cor atual fora da paleta
 * (ex.: âncora semeada no banco) entra na frente para continuar visível.
 */
export function ColumnColorPicker({ colors, value, onChange, className }: ColumnColorPickerProps) {
  const swatches = colors.includes(value) ? colors : [value, ...colors];

  return (
    <div role="radiogroup" aria-label="Cor da coluna" className={cn("flex flex-wrap gap-1.5 px-0.5", className)}>
      {swatches.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          aria-label={`Cor ${c}`}
          className={cn(
            "h-5 w-5 rounded-full ring-offset-2 ring-offset-card transition-shadow",
            value === c && "ring-2 ring-foreground/60"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
