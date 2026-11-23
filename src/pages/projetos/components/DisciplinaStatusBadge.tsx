import { AlertTriangle, CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DISCIPLINA_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2; bgColor: string }
> = {
  Concluído: {
    label: "Concluído",
    color: "text-positive-strong",
    icon: CheckCircle2,
    bgColor: "bg-positive/10 border-positive/20",
  },
  "Em Andamento": {
    label: "Em Andamento",
    color: "text-info-strong",
    icon: Clock,
    bgColor: "bg-info-soft border-info-mid-border",
  },
  "Não Iniciado": {
    label: "Não Iniciado",
    color: "text-ink-muted",
    icon: PauseCircle,
    bgColor: "bg-muted border-border",
  },
  Pendente: {
    label: "Pendente",
    color: "text-warning-strong",
    icon: AlertTriangle,
    bgColor: "bg-warning-soft border-warning-mid-border",
  },
};

export function DisciplinaStatusBadge({ status }: { status: string | undefined }) {
  const config = DISCIPLINA_STATUS_CONFIG[status || "Não Iniciado"] || DISCIPLINA_STATUS_CONFIG["Não Iniciado"];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("text-2xs gap-1 font-normal", config.bgColor, config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
