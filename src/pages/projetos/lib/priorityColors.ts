import { PROJECT_PRIORITY, type ProjectPriority } from "@/constants";

// Fonte única da cor do "dot" de prioridade usada em todas as telas do módulo
// Projetos (card, formulário e barra de filtros). Antes cada tela tinha seu
// próprio mapa e as cores divergiam entre si. Mesmas cores do ponto de
// prioridade das Tarefas (PRIORIDADE_DOT_CLASS), para o quadro ser um só (SPEC 122).
export const PRIORITY_DOT_COLOR: Record<ProjectPriority, string> = {
  [PROJECT_PRIORITY.ALTA]: "bg-destructive",
  [PROJECT_PRIORITY.MEDIA]: "bg-warning",
  [PROJECT_PRIORITY.BAIXA]: "bg-muted-foreground/40",
};

export function getPriorityDotColor(prioridade: string | null | undefined): string {
  return PRIORITY_DOT_COLOR[prioridade as ProjectPriority] ?? PRIORITY_DOT_COLOR[PROJECT_PRIORITY.MEDIA];
}
