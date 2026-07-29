import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { DashboardVencimento } from "@/hooks/useDashboardData";
import { formatCurrency } from "@/lib/format";

export function VencimentoRow({ item }: { item: DashboardVencimento }) {
  const isReceita = item.tipo === "receita";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isReceita ? "bg-positive/10" : "bg-negative/10"}`}
      >
        {isReceita ? (
          <ArrowUpRight size={14} className="text-positive-strong" />
        ) : (
          <ArrowDownRight size={14} className="text-negative-strong" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-soft truncate">{item.entidade || item.descricao}</p>
        <p className="text-[11px] text-ink-disabled truncate">{item.projeto || item.descricao}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${isReceita ? "text-positive-strong" : "text-negative-strong"}`}>
          {isReceita ? "+" : "-"}
          {formatCurrency(item.valor)}
        </p>
        <p className="text-[11px] text-ink-disabled">
          {item.diasRestantes === 0 ? "Hoje" : item.diasRestantes === 1 ? "Amanhã" : `${item.diasRestantes}d`}
        </p>
      </div>
    </div>
  );
}
