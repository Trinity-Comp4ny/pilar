import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { useHealthIndex, type HealthBreakdown } from "@/hooks/useHealthIndex";

const BREAKDOWN_LABELS: Record<keyof HealthBreakdown, string> = {
  margem: "Margem",
  previsibilidade: "Previsibilidade",
  ociosidade: "Ociosidade",
  atrasos: "Atrasos",
  inadimplencia: "Inadimplência",
  concentracao: "Concentração",
};

/** Mapeia o score (0-100) para classes de tom semântico (tokens), substituindo a
 *  cor inline do hook. Excelente/Bom → positivo, Atenção → warning, Crítico →
 *  attention, Emergência → danger. */
function scoreTone(score: number): { text: string; badge: string } {
  if (score >= 60) return { text: "text-positive-strong", badge: "bg-positive/10 text-positive-strong" };
  if (score >= 40) return { text: "text-warning-strong", badge: "bg-warning-soft text-warning-strong" };
  if (score >= 20) return { text: "text-attention-strong", badge: "bg-attention-soft text-attention-strong" };
  return { text: "text-negative-strong", badge: "bg-danger-soft text-danger-strong" };
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? "bg-chart-success" : value >= 40 ? "bg-chart-warning" : "bg-chart-danger";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-[90px] shrink-0">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-[11px] font-medium w-[28px] text-right">{value}</span>
    </div>
  );
}

export function HealthIndexCard() {
  const { data: health, isLoading } = useHealthIndex();

  if (isLoading || !health) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-black/60">Saúde operacional</CardTitle>
          <div className="p-2 rounded-full bg-muted text-ink-disabled">
            <Activity size={18} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-ink-disabled">—</div>
        </CardContent>
      </Card>
    );
  }

  const tone = scoreTone(health.score);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-black/60">Saúde operacional</CardTitle>
        <div className={`p-2 rounded-full ${tone.badge}`}>
          <Activity size={18} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-3xl font-bold ${tone.text}`}>{health.score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tone.badge}`}>{health.label}</span>
        </div>
        <div className="space-y-1.5">
          {(Object.keys(health.breakdown) as (keyof HealthBreakdown)[]).map((key) => (
            <ProgressBar key={key} value={health.breakdown[key]} label={BREAKDOWN_LABELS[key]} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
