import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
};

type Props<T extends string> = {
  options: ViewOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nome do grupo para leitor de tela (ex.: "Visualização"). */
  ariaLabel?: string;
  /** Em telas estreitas mostra só o ícone (o rótulo vira texto para leitor de tela). */
  iconOnlyOnMobile?: boolean;
  className?: string;
};

/**
 * Seletor de visão da mesma coleção (SPEC 124 / ADR 0059): Lista/Quadro/Agenda,
 * Tabela/Gantt/Fluxo, Diário/Mensal. Vai no começo da toolbar. Para trocar de seção
 * da página, use `SectionTabs`. Ativo é fundo verde com texto `ink` (regra de contraste
 * da marca: verde nunca em primeiro plano).
 */
export function ViewSwitcher<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = "Visualização",
  iconOnlyOnMobile = false,
  className,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border border-input bg-background p-0.5",
        className
      )}
    >
      {options.map((o) => {
        const ativa = o.value === value;
        const Icon = o.icon;
        const soIcone = iconOnlyOnMobile && Icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={ativa}
            aria-label={soIcone ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              ativa ? "bg-brand font-medium text-ink" : "text-muted-foreground hover:text-ink"
            )}
          >
            {Icon && <Icon size={14} aria-hidden className="shrink-0" />}
            <span className={cn(soIcone && "sr-only sm:not-sr-only")}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
