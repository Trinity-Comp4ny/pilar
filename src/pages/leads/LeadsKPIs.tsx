import { useMemo } from "react";
import { CalendarClock, Layers, TrendingUp, PercentCircle } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { type Lead } from "@/hooks/useLeads";

const ATIVOS = new Set(["Novo", "Em contato", "Proposta", "Negociação"]);

interface LeadsKPIsProps {
  leads: Lead[];
  onFilterProximos?: () => void;
  proximosAtivo?: boolean;
}

export function LeadsKPIs({ leads, onFilterProximos, proximosAtivo = false }: LeadsKPIsProps) {
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
      <KPICard icon={Layers} label="Pipeline ativo" value={stats.total.toString()} tone="neutral" />
      <KPICard icon={TrendingUp} label="Valor estimado" value={stats.valorPipeline} tone="positive" />
      <KPICard
        icon={CalendarClock}
        label="Fecham em 7 dias"
        value={stats.proximos.toString()}
        tone="warning"
        onClick={onFilterProximos}
        className={proximosAtivo ? "border-brand ring-1 ring-brand bg-brand/5" : undefined}
      />
      <KPICard
        icon={PercentCircle}
        label="Taxa de conversão"
        value={stats.taxaConversao !== null ? `${stats.taxaConversao}%` : "0%"}
        tone={
          stats.taxaConversao !== null && stats.taxaConversao >= 50
            ? "positive"
            : stats.taxaConversao === null
              ? "neutral"
              : "warning"
        }
      />
    </div>
  );
}
