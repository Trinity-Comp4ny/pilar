import { useMemo } from "react";
import { AlertTriangle, CalendarClock, Layers, TrendingUp } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { type Projeto, getDeadlineStatus } from "@/types/projetos";

interface ProjetosKPIsProps {
  projetos: Projeto[];
  onFilterAtraso?: () => void;
  onFilterProximos?: () => void;
}

export function ProjetosKPIs({ projetos, onFilterAtraso, onFilterProximos }: ProjetosKPIsProps) {
  const { can } = usePermissions();
  const podeVerValor = can("financeiro");
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
    <div className={cn("grid grid-cols-2 gap-2", podeVerValor ? "md:grid-cols-4" : "md:grid-cols-3")}>
      <KPICard density="compact" icon={Layers} label="Projetos ativos" value={stats.total.toString()} tone="neutral" />
      <KPICard
        density="compact"
        icon={AlertTriangle}
        label="Em atraso"
        value={stats.atrasados.toString()}
        tone="danger"
        onClick={stats.atrasados > 0 ? onFilterAtraso : undefined}
      />
      <KPICard
        density="compact"
        icon={CalendarClock}
        label="Próximas entregas (7d)"
        value={stats.proximos.toString()}
        tone="warning"
        onClick={stats.proximos > 0 ? onFilterProximos : undefined}
      />
      {/* Sem acesso a financeiro, valor_contrato já vem mascarado (null) de
          projetos_safe — esconder o card evita mostrar "R$ 0,00" enganoso. */}
      {podeVerValor && (
        <KPICard
          density="compact"
          icon={TrendingUp}
          label="Valor pipeline"
          value={stats.valorPipeline}
          tone="positive"
        />
      )}
    </div>
  );
}
