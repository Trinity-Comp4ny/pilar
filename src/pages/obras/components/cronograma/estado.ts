import type { EstadoFrente, EstadoTarefa } from "@/lib/obras";

type Estado = EstadoFrente | EstadoTarefa;

/** Preenchimento de barra e bolinha por estado (tokens de status, não paleta crua). */
export const ESTADO_FILL: Record<Estado, string> = {
  concluida: "bg-positive",
  atrasada: "bg-negative",
  em_andamento: "bg-status-progress",
  futura: "bg-status-unknown",
  sem_prazo: "bg-muted-foreground/30",
  sem_periodo: "bg-muted-foreground/30",
};

export const ESTADO_LABEL: Record<Estado, string> = {
  concluida: "Concluída",
  atrasada: "Atrasada",
  em_andamento: "Em andamento",
  futura: "A iniciar",
  sem_prazo: "Sem período",
  sem_periodo: "Sem período",
};

export const LEGENDA: EstadoFrente[] = ["em_andamento", "concluida", "atrasada", "futura"];
