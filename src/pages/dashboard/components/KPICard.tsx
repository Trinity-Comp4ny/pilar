import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @deprecated Use `@/components/KPICard` (ADR 0008). Este mantém a API antiga
 * baseada em classes de cor soltas (cardBg/titleColor/valueColor), que é a
 * deriva que o ADR proíbe. Migração pendente: mapear cada card do Dashboard
 * para um `tone` semântico (mudança visual, exige QA da tela mais usada).
 */
export function KPICard({
  title,
  value,
  cardBg,
  titleColor,
  valueColor,
  subtitleColor,
  variacao,
  invertVariacao,
  novo,
  subtitle,
  onClick,
}: {
  title: string;
  value: string;
  cardBg: string;
  titleColor: string;
  valueColor: string;
  subtitleColor: string;
  variacao?: number;
  // Quando true, cair é bom (ex.: despesa): a cor da variação inverte, mas a seta
  // continua indicando a direção real do valor (subiu/caiu).
  invertVariacao?: boolean;
  // Sem base no período anterior: não dá para calcular %, então mostramos "novo".
  novo?: boolean;
  subtitle?: string;
  onClick?: () => void;
}) {
  const subiu = (variacao ?? 0) > 0;
  const isBom = invertVariacao ? !subiu : subiu;
  const variacaoNode = novo ? (
    <span className="flex items-center gap-0.5 font-medium text-ink-soft">novo neste período</span>
  ) : variacao !== undefined && variacao !== 0 ? (
    <span className={`flex items-center gap-0.5 ${isBom ? "text-success-mid" : "text-danger-mid"}`}>
      {subiu ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
      {Math.abs(variacao).toFixed(1)}% vs período anterior
    </span>
  ) : null;

  return (
    <Card
      className={cn(
        "w-full",
        cardBg,
        onClick &&
          "cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${titleColor}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        {variacaoNode && <p className="text-xs mt-1 flex items-center gap-1">{variacaoNode}</p>}
        {subtitle && <p className={`text-xs mt-1 ${subtitleColor}`}>{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
