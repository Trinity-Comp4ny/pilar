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

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; columnColor: string }> = {
  [PROJECT_STATUS.PLANEJAMENTO]: {
    label: "Planejamento",
    color: "bg-yellow-100 text-yellow-800",
    columnColor: "bg-yellow-50",
  },
  [PROJECT_STATUS.EM_ANDAMENTO]: {
    label: "Em andamento",
    color: "bg-blue-100 text-blue-800",
    columnColor: "bg-blue-50",
  },
  [PROJECT_STATUS.REVISAO]: { label: "Revisão", color: "bg-purple-100 text-purple-800", columnColor: "bg-purple-50" },
  [PROJECT_STATUS.PARALISADO]: {
    label: "Paralisado",
    color: "bg-accent-orange/10 text-accent-orange",
    columnColor: "bg-accent-orange/5",
  },
  [PROJECT_STATUS.CONCLUIDO]: { label: "Concluído", color: "bg-green-100 text-green-800", columnColor: "bg-green-50" },
  [PROJECT_STATUS.CANCELADO]: { label: "Cancelado", color: "bg-red-100 text-red-800", columnColor: "bg-red-50" },
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
    sortWeight: number;
  }
> = {
  [PROJECT_PRIORITY.ALTA]: {
    label: "Alta",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-l-red-500",
    sortWeight: 0,
  },
  [PROJECT_PRIORITY.MEDIA]: {
    label: "Média",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-l-amber-400",
    sortWeight: 1,
  },
  [PROJECT_PRIORITY.BAIXA]: {
    label: "Baixa",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-l-blue-400",
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
  CONTRATADO: "contratado",
  TERCEIRIZADO: "terceirizado",
} as const;

export type ContractType = (typeof CONTRACT_TYPES)[keyof typeof CONTRACT_TYPES];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  [CONTRACT_TYPES.CONTRATADO]: "Contratado (CLT/PJ)",
  [CONTRACT_TYPES.TERCEIRIZADO]: "Terceirizado",
};

// Payment Methods
export const PAYMENT_METHODS = {
  PIX: "PIX",
  TRANSFERENCIA: "Transferência",
  BOLETO: "Boleto",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de Crédito",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

// User Roles
export const USER_ROLES = {
  ADMIN: "admin",
  FINANCEIRO: "financeiro",
  MARKETING: "marketing",
  OPERACIONAL: "operacional",
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
