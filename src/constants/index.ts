import { statusBadgeClasses, statusColumnClasses, statusLabel } from "@/lib/status";

// Project Status
export const PROJECT_STATUS = {
  PLANEJAMENTO: "Planejamento",
  EM_ANDAMENTO: "Em andamento",
  REVISAO: "Revisão",
  PARALISADO: "Paralisado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

// Cores derivam do registry único (ADR 0008): mudar tom = src/lib/status.ts.
const projStatus = (s: ProjectStatus) => ({
  label: statusLabel("projeto", s),
  color: statusBadgeClasses("projeto", s),
  columnColor: statusColumnClasses("projeto", s),
});

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; columnColor: string }> = {
  [PROJECT_STATUS.PLANEJAMENTO]: projStatus(PROJECT_STATUS.PLANEJAMENTO),
  [PROJECT_STATUS.EM_ANDAMENTO]: projStatus(PROJECT_STATUS.EM_ANDAMENTO),
  [PROJECT_STATUS.REVISAO]: projStatus(PROJECT_STATUS.REVISAO),
  [PROJECT_STATUS.PARALISADO]: projStatus(PROJECT_STATUS.PARALISADO),
  [PROJECT_STATUS.CONCLUIDO]: projStatus(PROJECT_STATUS.CONCLUIDO),
  [PROJECT_STATUS.CANCELADO]: projStatus(PROJECT_STATUS.CANCELADO),
};

export const KANBAN_COLUMN_ORDER: ProjectStatus[] = [
  PROJECT_STATUS.PLANEJAMENTO,
  PROJECT_STATUS.EM_ANDAMENTO,
  PROJECT_STATUS.REVISAO,
  PROJECT_STATUS.PARALISADO,
  PROJECT_STATUS.CONCLUIDO,
  PROJECT_STATUS.CANCELADO,
];

// Project Priority
export const PROJECT_PRIORITY = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAIXA: "Baixa",
} as const;

export type ProjectPriority = (typeof PROJECT_PRIORITY)[keyof typeof PROJECT_PRIORITY];

export const PROJECT_PRIORITY_CONFIG: Record<
  ProjectPriority,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    /** Dot sólido de prioridade (spec 011, substitui a border-l lateral). */
    dotColor: string;
    sortWeight: number;
  }
> = {
  [PROJECT_PRIORITY.ALTA]: {
    label: "Alta",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-l-red-500",
    dotColor: "bg-negative",
    sortWeight: 0,
  },
  [PROJECT_PRIORITY.MEDIA]: {
    label: "Média",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-l-amber-400",
    dotColor: "bg-chart-warning",
    sortWeight: 1,
  },
  [PROJECT_PRIORITY.BAIXA]: {
    label: "Baixa",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-l-blue-400",
    dotColor: "bg-chart-info",
    sortWeight: 2,
  },
};

export const PRIORITY_OPTIONS: ProjectPriority[] = [
  PROJECT_PRIORITY.ALTA,
  PROJECT_PRIORITY.MEDIA,
  PROJECT_PRIORITY.BAIXA,
];

// Financial Status
export const FINANCIAL_STATUS = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  RECEBIDO: "Recebido",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
} as const;

export type FinancialStatus = (typeof FINANCIAL_STATUS)[keyof typeof FINANCIAL_STATUS];

// Receitas use "Recebida" in the UI but "Recebido" in the DB
export const RECEITA_STATUS = {
  RECEBIDA: "Recebida",
  PENDENTE: "Pendente",
} as const;

export const DESPESA_STATUS = {
  PAGO: "Pago",
  PENDENTE: "Pendente",
} as const;

// Contract Types
export const CONTRACT_TYPES = {
  CLT: "clt",
  PJ: "pj",
  ESTAGIARIO: "estagiario",
  SOCIO: "socio",
  TERCEIRIZADO: "terceirizado",
} as const;

export type ContractType = (typeof CONTRACT_TYPES)[keyof typeof CONTRACT_TYPES];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  [CONTRACT_TYPES.CLT]: "CLT",
  [CONTRACT_TYPES.PJ]: "PJ",
  [CONTRACT_TYPES.ESTAGIARIO]: "Estagiário",
  [CONTRACT_TYPES.SOCIO]: "Sócio",
  [CONTRACT_TYPES.TERCEIRIZADO]: "Terceirizado",
};

export const CONTRACT_TYPE_COLORS: Record<ContractType, string> = {
  [CONTRACT_TYPES.CLT]: "bg-blue-100 text-blue-700 border-blue-200",
  [CONTRACT_TYPES.PJ]: "bg-purple-100 text-purple-700 border-purple-200",
  [CONTRACT_TYPES.ESTAGIARIO]: "bg-positive/10 text-positive-strong border-positive/20",
  [CONTRACT_TYPES.SOCIO]: "bg-amber-100 text-amber-700 border-amber-200",
  [CONTRACT_TYPES.TERCEIRIZADO]: "bg-gray-100 text-gray-700 border-gray-200",
};

// Pessoa Status
export const PESSOA_STATUS = {
  ATIVO: "ativo",
  INATIVO: "inativo",
  AFASTADO: "afastado",
} as const;

export type PessoaStatus = (typeof PESSOA_STATUS)[keyof typeof PESSOA_STATUS];

export const PESSOA_STATUS_LABELS: Record<PessoaStatus, string> = {
  [PESSOA_STATUS.ATIVO]: "Ativo",
  [PESSOA_STATUS.INATIVO]: "Inativo",
  [PESSOA_STATUS.AFASTADO]: "Afastado",
};

export const PESSOA_STATUS_COLORS: Record<PessoaStatus, string> = {
  [PESSOA_STATUS.ATIVO]: "bg-positive/10 text-positive-strong border-positive/20",
  [PESSOA_STATUS.INATIVO]: "bg-gray-100 text-gray-600 border-gray-200",
  [PESSOA_STATUS.AFASTADO]: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

// Payment Methods
export const PAYMENT_METHODS = {
  PIX: "PIX",
  TRANSFERENCIA: "Transferência",
  BOLETO: "Boleto",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO: "Cartão de Débito",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

// User Roles: a autoridade da conta, e desde o ADR 0029 o único eixo de
// permissão dentro da empresa (owner/coordenador/colaborador existem no enum e
// entram por set_access_profile).
export const USER_ROLES = {
  ULTRA_ADMIN: "ultra_admin",
  ADMIN: "admin",
  USER: "user",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Recurrence
export const RECURRENCE = {
  NENHUMA: "Nenhuma",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  ANUAL: "Anual",
} as const;

// Lead Status
export const LEAD_STATUS = {
  NOVO: "Novo",
  EM_CONTATO: "Em contato",
  PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

// Nota Fiscal
export const NOTA_FISCAL = {
  SIM: "Sim",
  NAO: "Não",
} as const;

// Origem (lead e cliente compartilham a mesma lista — BUG-3: a padronização
// do Lead não vazava pro Cliente, que era texto livre). "Outro" é sentinela de
// UI (abre um campo de texto livre), nunca vai pro banco como valor literal.
export const ORIGENS = ["Indicação", "Instagram", "LinkedIn", "Site", "Google", "WhatsApp", "Evento", "Outro"] as const;
export const ORIGEM_OUTRO = "Outro";
export const ORIGENS_CONHECIDAS = ORIGENS.filter((o) => o !== ORIGEM_OUTRO);

// Storage Keys
export const STORAGE_KEYS = {
  REMEMBER_ME: "pilar-remember-me",
  AUTH: "pilar-auth",
  USER_NAME: "pilar-user-name",
} as const;
