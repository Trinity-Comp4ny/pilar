import type { EstadoFrente, EstadoTarefa } from "@/lib/obras";

type Estado = EstadoFrente | EstadoTarefa;

/** Preenchimento de barra e bolinha por estado (tokens de status, não paleta crua). */
export const ESTADO_FILL: Record<Estado, string> = {
  concluida: "bg-brand",
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

export type NivelCor = "fase" | "etapa" | "servico" | "tarefa";

/**
 * Uma cor por nível (fase, etapa, serviço, tarefa) para a hierarquia ler de relance, na lista e no
 * Gantt. O estado (atrasada, concluída) continua à mostra pela bolinha, pelo texto e pelo contorno da barra.
 */
export const NIVEL_COR: Record<NivelCor, string> = {
  fase: "hsl(var(--c-ink-900))",
  etapa: "hsl(var(--c-orange-500))",
  servico: "hsl(var(--c-purple-500))",
  tarefa: "hsl(var(--chart-success))",
};

export const NIVEL_NOME: Record<NivelCor, string> = {
  fase: "Fase",
  etapa: "Etapa",
  servico: "Serviço",
  tarefa: "Tarefa",
};

/** Contorno da barra por estado: atrasada chama atenção, concluída recua. */
export const ESTADO_BARRA: Partial<Record<Estado, string>> = {
  atrasada: "ring-2 ring-negative ring-offset-1",
  concluida: "opacity-60",
};
