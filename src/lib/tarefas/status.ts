// Baldes de status compartilhados pelas duas abas de "Meu trabalho" (spec 008).
// Tarefas guardam esses valores nativamente; disciplinas chegam já mapeadas pela
// RPC get_minhas_disciplinas (função pilar_status_bucket no banco).
export type StatusBucket = "a_fazer" | "fazendo" | "concluida";

export const STATUS_ORDER: readonly StatusBucket[] = ["a_fazer", "fazendo", "concluida"];

export const STATUS_LABEL: Record<StatusBucket, string> = {
  a_fazer: "A fazer",
  fazendo: "Fazendo",
  concluida: "Concluído",
};

// Cores de fundo suave por status, com tokens semânticos (ADR 0008).
export const STATUS_BADGE_CLASS: Record<StatusBucket, string> = {
  a_fazer: "bg-muted text-muted-foreground",
  fazendo: "bg-warning-soft text-warning-strong",
  concluida: "bg-positive/15 text-positive-strong",
};

export function isStatusBucket(v: unknown): v is StatusBucket {
  return v === "a_fazer" || v === "fazendo" || v === "concluida";
}

// Prioridade compartilhada por tarefa e disciplina (spec 014). Minúsculo
// canônico; a disciplina chega já mapeada pela RPC get_minhas_disciplinas.
export type Prioridade = "alta" | "media" | "baixa";

export const PRIORIDADE_ORDER: readonly Prioridade[] = ["alta", "media", "baixa"];

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Ponto colorido por prioridade (fundo do "dot", ADR 0008).
export const PRIORIDADE_DOT_CLASS: Record<Prioridade, string> = {
  alta: "bg-destructive",
  media: "bg-warning",
  baixa: "bg-muted-foreground/40",
};

export function isPrioridade(v: unknown): v is Prioridade {
  return v === "alta" || v === "media" || v === "baixa";
}

// Paleta das colunas (etapas). Guardada como hex em tarefa_etapas.cor; o dot usa
// backgroundColor inline. As três âncoras de status têm cor padrão por bucket.
export const CORES_ETAPA = [
  "#94a3b8",
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

const COR_POR_BUCKET: Record<StatusBucket, string> = {
  a_fazer: "#94a3b8",
  fazendo: "#f59e0b",
  concluida: "#10b981",
};

/** Cor do dot de uma coluna: a cor escolhida, ou a padrão do bucket, ou cinza. */
export function corDaEtapa(cor: string | null, bucket: StatusBucket | null): string {
  if (cor) return cor;
  if (bucket) return COR_POR_BUCKET[bucket];
  return "#94a3b8";
}

export function toPrioridade(v: unknown): Prioridade {
  return isPrioridade(v) ? v : "media";
}
