import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const toCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

interface Summary {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
}

interface RelatoriosSummaryProps {
  summary: Summary;
  tipoRelatorio: string;
  showBoth: boolean;
}

export function RelatoriosSummary({ summary, tipoRelatorio, showBoth }: RelatoriosSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      {tipoRelatorio !== "despesas" && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="rounded-lg bg-emerald-100 p-2">
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-emerald-600 font-medium">Receitas</p>
            <p className="text-lg font-bold text-emerald-700 truncate">{toCurrency(summary.totalReceitas)}</p>
          </div>
        </div>
      )}
      {tipoRelatorio !== "receitas" && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="rounded-lg bg-red-100 p-2">
            <TrendingDown size={18} className="text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-red-600 font-medium">Despesas</p>
            <p className="text-lg font-bold text-red-700 truncate">{toCurrency(summary.totalDespesas)}</p>
          </div>
        </div>
      )}
      {showBoth && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3",
            summary.saldo >= 0 ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"
          )}
        >
          <div className={cn("rounded-lg p-2", summary.saldo >= 0 ? "bg-blue-100" : "bg-orange-100")}>
            <DollarSign size={18} className={summary.saldo >= 0 ? "text-blue-600" : "text-orange-600"} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-xs font-medium", summary.saldo >= 0 ? "text-blue-600" : "text-orange-600")}>Saldo</p>
            <p className={cn("text-lg font-bold truncate", summary.saldo >= 0 ? "text-blue-700" : "text-orange-700")}>
              {toCurrency(summary.saldo)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
