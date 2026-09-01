/**
 * Registry ÚNICO de status (ADR 0008, spec 003 onda 2).
 *
 * Todo status exibido em badge/chip resolve label e cor AQUI, por domínio.
 * Cor é sempre um TOM semântico (tokens.css), nunca paleta crua: "Pago" tem a
 * mesma cor em Financeiro, Relatórios, Portal e detalhe do projeto.
 * Os mapas legados por página (PROJECT_STATUS_CONFIG, PROPOSTA_STATUS_CONFIG...)
 * derivam daqui até a migração dos pontos de render terminar.
 */

export type StatusTone =
  "neutral" | "info" | "warning" | "attention" | "positive" | "danger" | "brand" | "done" | "highlight";

/** Badge/chip: fundo suave + texto forte (contraste AA nos tokens). */
export const TONE_BADGE: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-soft text-info-strong",
  warning: "bg-warning-soft text-warning-strong",
  attention: "bg-attention-soft text-attention-strong",
  positive: "bg-positive/10 text-positive-strong",
  danger: "bg-danger-soft text-danger-strong",
  brand: "bg-brand text-ink",
  done: "bg-status-done/10 text-status-done",
  highlight: "bg-highlight-soft text-highlight-strong",
};

/**
 * Cor do VALOR de um KPI por tom (spec 011). Só `positive`/`danger` colorem;
 * os demais ficam em tinta pra o número não virar semáforo. `text-brand` nunca
 * entra aqui (regra da marca: verde-500 só como fundo).
 */
export const TONE_VALUE: Record<StatusTone, string> = {
  neutral: "text-ink",
  info: "text-ink",
  warning: "text-ink",
  attention: "text-ink",
  positive: "text-positive-strong",
  danger: "text-negative-strong",
  brand: "text-ink",
  done: "text-ink",
  highlight: "text-ink",
};

/** Fundo de coluna kanban: tint mais leve do mesmo tom. */
export const TONE_COLUMN: Record<StatusTone, string> = {
  neutral: "bg-muted/50",
  info: "bg-info-soft/50",
  warning: "bg-warning-soft/50",
  attention: "bg-attention-soft/50",
  positive: "bg-positive/5",
  danger: "bg-danger-soft/50",
  brand: "bg-brand/5",
  done: "bg-status-done/5",
  highlight: "bg-highlight-soft/50",
};

export type StatusDomain =
  | "projeto"
  | "proposta"
  | "lead"
  | "financeiro"
  | "tipo"
  | "obra"
  | "cotacao"
  | "escopo"
  | "status_componente"
  | "status_incidente";

type StatusDef = { label: string; tone: StatusTone };

export const STATUS_REGISTRY: Record<StatusDomain, Record<string, StatusDef>> = {
  projeto: {
    Planejamento: { label: "Planejamento", tone: "warning" },
    "Em andamento": { label: "Em andamento", tone: "info" },
    Revisão: { label: "Revisão", tone: "highlight" },
    Paralisado: { label: "Paralisado", tone: "brand" },
    Concluído: { label: "Concluído", tone: "done" },
    Cancelado: { label: "Cancelado", tone: "danger" },
  },
  proposta: {
    rascunho: { label: "Rascunho", tone: "neutral" },
    enviada: { label: "Enviada", tone: "info" },
    aceita: { label: "Aceita", tone: "positive" },
    recusada: { label: "Recusada", tone: "danger" },
    expirada: { label: "Expirada", tone: "warning" },
  },
  lead: {
    Novo: { label: "Novo", tone: "info" },
    "Em contato": { label: "Em Contato", tone: "highlight" },
    Proposta: { label: "Proposta Enviada", tone: "warning" },
    Negociação: { label: "Em Negociação", tone: "brand" },
    Ganho: { label: "Ganho", tone: "positive" },
    Perdido: { label: "Perdido", tone: "danger" },
  },
  financeiro: {
    Pendente: { label: "Pendente", tone: "warning" },
    Pago: { label: "Pago", tone: "positive" },
    Recebido: { label: "Recebido", tone: "positive" },
    Atrasado: { label: "Atrasado", tone: "danger" },
    Vencido: { label: "Vencido", tone: "danger" },
    Cancelado: { label: "Cancelado", tone: "neutral" },
  },
  // "Receita"/"Despesa" não são status, mas seguem os mesmos tons.
  tipo: {
    Receita: { label: "Receita", tone: "positive" },
    Despesa: { label: "Despesa", tone: "danger" },
  },
  obra: {
    planejada: { label: "Planejada", tone: "warning" },
    em_andamento: { label: "Em andamento", tone: "info" },
    paralisada: { label: "Paralisada", tone: "brand" },
    concluida: { label: "Concluída", tone: "done" },
  },
  cotacao: {
    aberta: { label: "Aberta", tone: "info" },
    decidida: { label: "Decidida", tone: "positive" },
    cancelada: { label: "Cancelada", tone: "neutral" },
  },
  escopo: {
    rascunho: { label: "Rascunho", tone: "neutral" },
    pendente_aprovacao: { label: "Pendente de aprovação", tone: "warning" },
    aprovado: { label: "Aprovado", tone: "positive" },
    rejeitado: { label: "Rejeitado", tone: "danger" },
  },
  status_componente: {
    operacional: { label: "Operacional", tone: "positive" },
    degradado: { label: "Degradado", tone: "warning" },
    parcial: { label: "Parcial", tone: "attention" },
    outage: { label: "Fora do ar", tone: "danger" },
  },
  status_incidente: {
    investigando: { label: "Investigando", tone: "warning" },
    identificado: { label: "Identificado", tone: "attention" },
    monitorando: { label: "Monitorando", tone: "info" },
    resolvido: { label: "Resolvido", tone: "positive" },
  },
};

const FALLBACK: StatusDef = { label: "", tone: "neutral" };

export function statusDef(domain: StatusDomain, status: string): StatusDef {
  return STATUS_REGISTRY[domain][status] ?? { ...FALLBACK, label: status };
}

export function statusLabel(domain: StatusDomain, status: string): string {
  return statusDef(domain, status).label || status;
}

export function statusBadgeClasses(domain: StatusDomain, status: string): string {
  return TONE_BADGE[statusDef(domain, status).tone];
}

export function statusColumnClasses(domain: StatusDomain, status: string): string {
  return TONE_COLUMN[statusDef(domain, status).tone];
}
