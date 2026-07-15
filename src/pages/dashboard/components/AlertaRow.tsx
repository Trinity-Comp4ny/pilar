import { AlertTriangle } from "lucide-react";
import type { DashboardAlerta } from "@/hooks/useDashboardData";

export function AlertaRow({ alerta }: { alerta: DashboardAlerta }) {
  const sevConfig: Record<string, { bg: string; icon: string }> = {
    critical: { bg: "bg-danger-soft border-danger-mid-border", icon: "text-chart-danger" },
    high: { bg: "bg-attention-soft border-attention-mid-border", icon: "text-status-paused" },
    medium: { bg: "bg-warning-soft border-warning-mid-border", icon: "text-warning-mid" },
    low: { bg: "bg-info-soft border-info-mid-border", icon: "text-chart-info" },
  };
  const config = sevConfig[alerta.severidade] || sevConfig.low;

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${config.bg}`}>
      <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${config.icon}`} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-soft">{alerta.titulo}</p>
        <p className="text-[11px] text-muted-foreground truncate">{alerta.mensagem}</p>
      </div>
    </div>
  );
}
