import { useMemo } from "react";
import { CalendarClock, Layers, TrendingUp, PercentCircle, Handshake } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { type Lead } from "@/hooks/useLeads";
import { type Proposta } from "@/hooks/usePropostas";
import { propostaPrimaria, valorNoFunil, taxaFechamentoPropostas } from "@/lib/comercial";

const ATIVOS = new Set(["Novo", "Em contato", "Proposta", "Negociação"]);

interface LeadsKPIsProps {
  leads: Lead[];
  propostasByLead: Map<string, Proposta[]>;
  onFilterProximos?: () => void;
  proximosAtivo?: boolean;
}

export function LeadsKPIs({ leads, propostasByLead, onFilterProximos, proximosAtivo = false }: LeadsKPIsProps) {
  const stats = useMemo(() => {
    const ativos = leads.filter((l) => ATIVOS.has(l.status));
    // Valor no funil: proposta real quando existe, senão o estimado. A primária
    // (uma por lead) garante que nenhum lead conta duas vezes no somatório.
    const valorPipeline = ativos.reduce(
      (sum, l) => sum + valorNoFunil(l, propostaPrimaria(propostasByLead.get(l.id) ?? [])),
      0
    );

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
    const conversaoLeads = fechados > 0 ? Math.round((ganhos / fechados) * 100) : null;

    // Taxa de fechamento das propostas (aceita ÷ que saíram do rascunho). Só as
    // propostas ligadas a lead — o funil aqui é de negócio novo.
    const propostasDoFunil = Array.from(propostasByLead.values()).flat();
    const fechamentoPropostas = taxaFechamentoPropostas(propostasDoFunil);

    return {
      total: ativos.length,
      valorPipeline,
      proximos: proximos.length,
      conversaoLeads,
      fechamentoPropostas,
    };
  }, [leads, propostasByLead]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 flex-shrink-0">
      <KPICard density="compact" icon={Layers} label="Pipeline ativo" value={stats.total.toString()} tone="neutral" />
      <KPICard density="compact" icon={TrendingUp} label="Valor no funil" value={stats.valorPipeline} tone="positive" />
      <KPICard
        density="compact"
        icon={CalendarClock}
        label="Fecham em 7 dias"
        value={stats.proximos.toString()}
        tone="warning"
        onClick={onFilterProximos}
        className={proximosAtivo ? "border-brand ring-1 ring-brand bg-brand/5" : undefined}
      />
      <KPICard
        density="compact"
        icon={PercentCircle}
        label="Conversão de leads"
        value={stats.conversaoLeads !== null ? `${stats.conversaoLeads}%` : "0%"}
        tone={
          stats.conversaoLeads !== null && stats.conversaoLeads >= 50
            ? "positive"
            : stats.conversaoLeads === null
              ? "neutral"
              : "warning"
        }
      />
      <KPICard
        density="compact"
        icon={Handshake}
        label="Fechamento de propostas"
        value={stats.fechamentoPropostas !== null ? `${stats.fechamentoPropostas}%` : "—"}
        tone={
          stats.fechamentoPropostas !== null && stats.fechamentoPropostas >= 50
            ? "positive"
            : stats.fechamentoPropostas === null
              ? "neutral"
              : "warning"
        }
      />
    </div>
  );
}
