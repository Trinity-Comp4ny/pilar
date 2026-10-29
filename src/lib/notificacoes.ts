/**
 * Metadados de apresentação das notificações (spec 029). Funções puras e mapas,
 * testáveis sem React: o hook e os componentes só consomem daqui.
 */
import { Bell, HardHat, Layers, ListTodo, FolderKanban, Wallet, type LucideIcon } from "lucide-react";

// "sistema" saiu da lista (spec 091): nenhum evento no sistema cria notificação com essa
// categoria, e mantê-la em Preferências fazia parecer que havia algo pra controlar ali. Se um
// evento de categoria "sistema" existir de novo no futuro, iconeCategoria/rotuloCategoria abaixo
// seguem cobrindo com fallback (Bell / "Notificação") mesmo sem entrada explícita no mapa.
export type CategoriaNotificacao = "tarefa" | "projeto" | "disciplina" | "financeiro" | "obra";

export const CATEGORIAS: readonly CategoriaNotificacao[] = [
  "tarefa",
  "projeto",
  "disciplina",
  "financeiro",
  "obra",
] as const;

/**
 * Padrão do canal e-mail quando o usuário nunca escolheu (linha ausente ou
 * `email` NULL). Espelho de `public.notificacao_email_padrao()` (SPEC 096):
 * financeiro, projeto, disciplina e obra chegam por e-mail; tarefa não.
 */
export function emailPadraoCategoria(categoria: string): boolean {
  return categoria === "financeiro" || categoria === "projeto" || categoria === "disciplina" || categoria === "obra";
}

const CATEGORIA_LABEL: Record<CategoriaNotificacao, string> = {
  tarefa: "Tarefas",
  projeto: "Projetos",
  disciplina: "Disciplinas",
  financeiro: "Financeiro",
  obra: "Obras",
};

const CATEGORIA_ICON: Record<CategoriaNotificacao, LucideIcon> = {
  tarefa: ListTodo,
  projeto: FolderKanban,
  disciplina: Layers,
  financeiro: Wallet,
  obra: HardHat,
};

/**
 * Avisos do portal ultra admin (categoria "sistema": feedback, cadastro, plano
 * bloqueado). Fica fora de CATEGORIAS de propósito: não há o que configurar em
 * Preferências, só o ultra admin os recebe e filtra no sino.
 */
export const CATEGORIA_PORTAL = "sistema";

/** Filtro de categoria do sino: as do usuário comum mais "sistema" (só o ultra admin vê). */
export type CategoriaFiltro = CategoriaNotificacao | typeof CATEGORIA_PORTAL;

export type TipoPortal = "problema" | "sugestao" | "cadastro" | "outros";

export const TIPOS_PORTAL: readonly TipoPortal[] = ["problema", "sugestao", "cadastro", "outros"] as const;

export const TIPO_PORTAL_LABEL: Record<TipoPortal, string> = {
  problema: "Problemas",
  sugestao: "Sugestões",
  cadastro: "Cadastros",
  outros: "Outros",
};

// O trigger do feedback grava o tipo do relato só no título (tg_feedback_avisa_ultra_admins).
const TITULO_PROBLEMA = "Problema relatado";
const PREFIXO_SUGESTAO = "Sugestão:";

/** Tipo de um aviso do portal, a partir de `tipo` e `titulo`. */
export function tipoPortal(n: { tipo: string; titulo: string }): TipoPortal {
  if (n.tipo === "novo_cadastro") return "cadastro";
  if (n.tipo === "feedback_recebido") return n.titulo.startsWith(PREFIXO_SUGESTAO) ? "sugestao" : "problema";
  return "outros";
}

export type CondicaoNotificacao = { coluna: "tipo" | "titulo"; operador: "eq" | "like" | "not.in"; valor: string };

/** Condições PostgREST equivalentes a `tipoPortal`, pra filtrar no banco (o limite de 50 vale pelo filtro). */
export function condicoesTipoPortal(tipo: TipoPortal | null): CondicaoNotificacao[] {
  switch (tipo) {
    case "problema":
      return [
        { coluna: "tipo", operador: "eq", valor: "feedback_recebido" },
        { coluna: "titulo", operador: "eq", valor: TITULO_PROBLEMA },
      ];
    case "sugestao":
      return [
        { coluna: "tipo", operador: "eq", valor: "feedback_recebido" },
        { coluna: "titulo", operador: "like", valor: `${PREFIXO_SUGESTAO}*` },
      ];
    case "cadastro":
      return [{ coluna: "tipo", operador: "eq", valor: "novo_cadastro" }];
    case "outros":
      return [{ coluna: "tipo", operador: "not.in", valor: "(feedback_recebido,novo_cadastro)" }];
    default:
      return [];
  }
}

/** Soma de itens por categoria (ex.: não lidas de cada uma). Categoria vem do banco, então a chave é string. */
export function contarPorCategoria(itens: readonly { categoria: string }[]): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const { categoria } of itens) contagem[categoria] = (contagem[categoria] ?? 0) + 1;
  return contagem;
}

/** Ícone da categoria, com fallback para categorias desconhecidas (dado do banco). */
export function iconeCategoria(categoria: string): LucideIcon {
  return CATEGORIA_ICON[categoria as CategoriaNotificacao] ?? Bell;
}

/** Rótulo da categoria, com fallback legível. */
export function rotuloCategoria(categoria: string): string {
  if (categoria === CATEGORIA_PORTAL) return "Portal";
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
