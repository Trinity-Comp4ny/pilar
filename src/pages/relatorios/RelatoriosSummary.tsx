import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { KPICard } from "@/components/KPICard";

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
        <KPICard icon={TrendingUp} label="Receitas" value={summary.totalReceitas} tone="positive" />
      )}
      {tipoRelatorio !== "receitas" && (
        <KPICard icon={TrendingDown} label="Despesas" value={summary.totalDespesas} tone="danger" />
      )}
      {showBoth && (
        <KPICard
          icon={DollarSign}
          label="Saldo"
          value={summary.saldo}
          tone={summary.saldo >= 0 ? "positive" : "danger"}
        />
      )}
    </div>
  );
}
