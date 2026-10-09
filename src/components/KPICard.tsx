import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { TONE_BADGE, TONE_VALUE, type StatusTone } from "@/lib/status";
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
  /** Colore a sub-linha (ex.: "R$ X vencido" em vermelho). Default: cinza. */
  subtitleTone?: "muted" | "positive" | "danger";
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  /** Força a cor do número, ignorando o `tone`. Use quando o número deve ficar
   *  neutro mas o ícone/badge carrega o tom (raro). */
  valueTone?: StatusTone;
  /** Substitui o `value` formatado por um campo editável (ex.: DatePicker, MoneyInput).
   *  `value` continua obrigatório como fallback pro estado não-editável/loading. */
  valueSlot?: React.ReactNode;
  /** "compact" reduz o padding, para caber mais em faixas colapsáveis (spec 061). */
  density?: "default" | "compact";
}

export function KPICard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  delta,
  subtitle,
  subtitleTone = "muted",
  loading = false,
  onClick,
  className,
  valueTone,
  valueSlot,
  density = "default",
}: KPICardProps) {
  const formatCurrency = useMoneyMask();
  const valorFormatado = typeof value === "number" ? formatCurrency(value) : value;
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
        "@container rounded-2xl border border-black/5 bg-white w-full",
        density === "compact" ? "p-3" : "p-4",
        interactive &&
          "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
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
      {/* Ícone na linha do rótulo e valor com a largura inteira do card. Antes o
          valor dividia a linha com o ícone e, com `whitespace-nowrap`, vazava por
          baixo dele ("R$ 63.130,00" em Lançamentos, contrato e prazo no detalhe do
          projeto, tudo ilegível a 1024px). Card estreito baixa um degrau de fonte
          (container query); se ainda não couber, corta com reticências e o valor
          completo fica no title. */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 pt-0.5 text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && (
          <span className={cn("-mr-1 -mt-1 shrink-0 rounded-full p-1.5", TONE_BADGE[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      {!loading && valueSlot ? (
        <div className="mt-1 -ml-1 min-w-0">{valueSlot}</div>
      ) : (
        <p
          title={loading ? undefined : valorFormatado}
          className={cn(
            "mt-1 truncate text-base font-bold tabular-nums @[9rem]:text-lg",
            TONE_VALUE[valueTone ?? tone]
          )}
        >
          {loading ? <Skeleton className="inline-block h-6 w-24 align-middle" /> : valorFormatado}
        </p>
      )}
      {!loading && deltaNode && <p className="text-xs mt-1 flex items-center gap-1">{deltaNode}</p>}
      {!loading && subtitle && (
        <p
          className={cn(
            "text-xs mt-1 tabular-nums",
            subtitleTone === "positive"
              ? "text-positive-strong"
              : subtitleTone === "danger"
                ? "text-negative-strong"
                : "text-muted-foreground"
          )}
        >
          {subtitle}
        </p>
      )}
    </Card>
  );
}
