import { PROJECT_PRIORITY, type ProjectPriority } from "@/constants";

// Fonte única da cor do "dot" de prioridade usada em todas as telas do módulo
// Projetos (card, formulário e barra de filtros). Antes cada tela tinha seu
// próprio mapa e as cores divergiam entre si.
export const PRIORITY_DOT_COLOR: Record<ProjectPriority, string> = {
  [PROJECT_PRIORITY.ALTA]: "bg-red-500",
  [PROJECT_PRIORITY.MEDIA]: "bg-amber-400",
  [PROJECT_PRIORITY.BAIXA]: "bg-blue-400",
};

export function getPriorityDotColor(prioridade: string | null | undefined): string {
  return PRIORITY_DOT_COLOR[prioridade as ProjectPriority] ?? PRIORITY_DOT_COLOR[PROJECT_PRIORITY.MEDIA];
}
