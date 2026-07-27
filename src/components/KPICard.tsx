import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { TONE_BADGE, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Card de indicador único do app (ADR 0008, spec 003 onda 3).
 * Extraído da melhor implementação existente (loading embutido do Financeiro +
 * variação/acessibilidade do Dashboard). Cor vem de TOM semântico, nunca de
 * classe de cor passada por fora.
 */
export interface KPICardProps {
  label: string;
  /** number é formatado como moeda; string é exibida como veio. */
  value: string | number;
  icon?: LucideIcon;
  tone?: StatusTone;
  /** Variação vs período anterior. `invert`: cair é bom (ex.: despesa). */
  delta?: { value?: number; invert?: boolean; isNew?: boolean };
  subtitle?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function KPICard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  delta,
  subtitle,
  loading = false,
  onClick,
  className,
}: KPICardProps) {
  const subiu = (delta?.value ?? 0) > 0;
  const bom = delta?.invert ? !subiu : subiu;

  const deltaNode = delta?.isNew ? (
    <span className="text-ink-soft font-medium">novo neste período</span>
  ) : delta?.value !== undefined && delta.value !== 0 ? (
    <span className={cn("flex items-center gap-0.5", bom ? "text-success-mid" : "text-danger-mid")}>
      {subiu ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(delta.value).toFixed(1)}% vs período anterior
    </span>
  ) : null;

  const interactive = !!onClick;

  return (
    <Card
      className={cn(
        "rounded-2xl border border-black/5 bg-white p-4 w-full",
        interactive &&
          "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold mt-1 whitespace-nowrap tabular-nums">
            {loading ? (
              <Skeleton className="inline-block h-6 w-24 align-middle" />
            ) : typeof value === "number" ? (
              formatCurrency(value)
            ) : (
              value
            )}
          </p>
          {!loading && deltaNode && <p className="text-xs mt-1 flex items-center gap-1">{deltaNode}</p>}
          {!loading && subtitle && <p className="text-xs mt-1 text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <span className={cn("rounded-full p-2 flex-shrink-0", TONE_BADGE[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
    </Card>
  );
}
