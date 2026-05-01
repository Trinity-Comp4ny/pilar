import { useMemo } from "react";
import { AlertTriangle, CalendarClock, Layers, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Projeto, formatCurrency, getDeadlineStatus } from "@/types/projetos";

interface ProjetosKPIsProps {
  projetos: Projeto[];
  onFilterAtraso?: () => void;
  onFilterProximos?: () => void;
}

export function ProjetosKPIs({ projetos, onFilterAtraso, onFilterProximos }: ProjetosKPIsProps) {
  const stats = useMemo(() => {
    const ativos = projetos.filter((p) => p.status !== "Cancelado" && p.status !== "Concluído");
    const atrasados = ativos.filter((p) => {
      const d = getDeadlineStatus(p);
      return d?.status_data === "em_atraso";
    });
    const valorPipeline = ativos.reduce((sum, p) => sum + (p.valor_contrato || 0), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const proximos = ativos.filter((p) => {
      if (!p.data_previsao) return false;
      const prev = new Date(p.data_previsao + "T00:00:00");
      return prev >= today && prev <= in7;
    });
    return {
      total: ativos.length,
      atrasados: atrasados.length,
      valorPipeline,
      proximos: proximos.length,
    };
  }, [projetos]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      <KpiCard icon={Layers} label="Projetos ativos" value={stats.total.toString()} color="text-foreground" />
      <KpiCard
        icon={AlertTriangle}
        label="Em atraso"
        value={stats.atrasados.toString()}
        color="text-red-600"
        onClick={stats.atrasados > 0 ? onFilterAtraso : undefined}
      />
      <KpiCard
        icon={CalendarClock}
        label="Próximas entregas (7d)"
        value={stats.proximos.toString()}
        color="text-amber-600"
        onClick={stats.proximos > 0 ? onFilterProximos : undefined}
      />
      <KpiCard
        icon={TrendingUp}
        label="Valor pipeline"
        value={formatCurrency(stats.valorPipeline)}
        color="text-positive"
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
}

function KpiCard({ icon: Icon, label, value, color, onClick }: KpiCardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
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
