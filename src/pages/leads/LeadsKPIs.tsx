import { useMemo } from "react";
import { CalendarClock, Layers, TrendingUp, PercentCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";
import { type Lead } from "@/hooks/useLeads";

const ATIVOS = new Set(["Novo", "Em contato", "Proposta", "Negociação"]);

interface LeadsKPIsProps {
  leads: Lead[];
  onFilterProximos?: () => void;
}

export function LeadsKPIs({ leads, onFilterProximos }: LeadsKPIsProps) {
  const stats = useMemo(() => {
    const ativos = leads.filter((l) => ATIVOS.has(l.status));
    const valorPipeline = ativos.reduce((sum, l) => sum + (l.valor_estimado ?? 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const proximos = ativos.filter((l) => {
      if (!l.previsao_fechamento) return false;
      const d = new Date(l.previsao_fechamento + "T00:00:00");
      return d >= today && d <= in7;
    });

    const ganhos = leads.filter((l) => l.status === "Ganho").length;
    const perdidos = leads.filter((l) => l.status === "Perdido").length;
    const fechados = ganhos + perdidos;
    const taxaConversao = fechados > 0 ? Math.round((ganhos / fechados) * 100) : null;

    return {
      total: ativos.length,
      valorPipeline,
      proximos: proximos.length,
      taxaConversao,
    };
  }, [leads]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 flex-shrink-0">
      <KpiCard icon={Layers} label="Pipeline ativo" value={stats.total.toString()} color="text-foreground" />
      <KpiCard
        icon={TrendingUp}
        label="Valor estimado"
        value={stats.valorPipeline > 0 ? formatCurrency(stats.valorPipeline) : "—"}
        color="text-positive"
      />
      <KpiCard
        icon={CalendarClock}
        label="Fecham em 7 dias"
        value={stats.proximos.toString()}
        color="text-warning"
        onClick={onFilterProximos}
        title="Filtrar leads que fecham nos próximos 7 dias"
      />
      <KpiCard
        icon={PercentCircle}
        label="Taxa de conversão"
        value={stats.taxaConversao !== null ? `${stats.taxaConversao}%` : "—"}
        color={
          stats.taxaConversao === null
            ? "text-muted-foreground"
            : stats.taxaConversao >= 50
              ? "text-positive"
              : "text-warning"
        }
      />
    </div>
  );
}

interface KpiCardProps {
  icon: typeof Layers;
  label: string;
  value: string;
  color: string;
  onClick?: () => void;
  title?: string;
}

function KpiCard({ icon: Icon, label, value, color, onClick, title }: KpiCardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border bg-white text-left transition-colors",
        onClick && "hover:bg-muted/40 cursor-pointer"
      )}
    >
      <div className={cn("h-8 w-8 rounded-md flex items-center justify-center bg-muted/50", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wide truncate">{label}</p>
        <p className={cn("text-sm font-semibold tabular-nums truncate", color)}>{value}</p>
      </div>
    </Component>
  );
}
