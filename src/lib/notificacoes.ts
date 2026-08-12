/**
 * Metadados de apresentação das notificações (spec 029). Funções puras e mapas,
 * testáveis sem React: o hook e os componentes só consomem daqui.
 */
import { Bell, HardHat, Layers, ListTodo, FolderKanban, Wallet, type LucideIcon } from "lucide-react";

export type CategoriaNotificacao = "tarefa" | "projeto" | "disciplina" | "financeiro" | "obra" | "sistema";

export const CATEGORIAS: readonly CategoriaNotificacao[] = [
  "tarefa",
  "projeto",
  "disciplina",
  "financeiro",
  "obra",
  "sistema",
] as const;

export const CATEGORIA_LABEL: Record<CategoriaNotificacao, string> = {
  tarefa: "Tarefas",
  projeto: "Projetos",
  disciplina: "Disciplinas",
  financeiro: "Financeiro",
  obra: "Obras",
  sistema: "Sistema",
};

const CATEGORIA_ICON: Record<CategoriaNotificacao, LucideIcon> = {
  tarefa: ListTodo,
  projeto: FolderKanban,
  disciplina: Layers,
  financeiro: Wallet,
  obra: HardHat,
  sistema: Bell,
};

/** Ícone da categoria, com fallback para categorias desconhecidas (dado do banco). */
export function iconeCategoria(categoria: string): LucideIcon {
  return CATEGORIA_ICON[categoria as CategoriaNotificacao] ?? Bell;
}

/** Rótulo da categoria, com fallback legível. */
export function rotuloCategoria(categoria: string): string {
  return CATEGORIA_LABEL[categoria as CategoriaNotificacao] ?? "Notificação";
}

/** Classe de cor do marcador por severidade (mesma escala dos alertas). */
export const SEVERIDADE_TONE: Record<string, string> = {
  low: "bg-info-soft text-chart-info",
  medium: "bg-warning-soft text-chart-warning",
  high: "bg-warning-soft text-chart-warning",
  critical: "bg-danger-soft text-chart-danger",
};

export function toneSeveridade(severidade: string): string {
  return SEVERIDADE_TONE[severidade] ?? SEVERIDADE_TONE.medium;
}

/** Rota interna para abrir o item referenciado. Usa `link`; sem ele, não navega. */
export function resolveLink(n: { link?: string | null }): string | null {
  const link = n.link?.trim();
  return link ? link : null;
}

/** "agora", "5min", "3h", "2d" — tempo relativo curto. `agora` injetável p/ teste. */
export function formatTimeAgo(dateStr: string, agora: number = Date.now()): string {
  const diff = agora - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return `${dias}d`;
}
