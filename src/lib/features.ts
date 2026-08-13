import {
  BarChart,
  Boxes,
  Brain,
  Building2,
  Calendar,
  ClipboardList,
  CloudSun,
  FileText,
  GanttChartSquare,
  Globe,
  HardHat,
  Home,
  LayoutTemplate,
  ListTodo,
  MapPin,
  Scale,
  Sparkles,
  Target,
  Truck,
  UserPlus,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type FeatureKey =
  | "dashboard"
  | "relatorios"
  | "leads"
  | "propostas"
  | "clientes"
  | "projetos"
  | "mapa"
  | "financeiro"
  | "pessoas"
  | "metas"
  | "portal_cliente"
  | "ai_hub"
  | "capacidade"
  | "templates"
  | "timesheet"
  | "ai_chat"
  | "meu_trabalho"
  | "obras"
  // Sub-features do módulo Obras (parent: "obras"). Gate de experiência (UI + rota),
  // não fronteira de dados: a proteção do dado segue no nível do módulo. Ver ADR 0019.
  | "obras_fornecedores"
  | "obras_clima"
  | "obras_diario"
  | "obras_cronograma"
  | "obras_cotacoes"
  | "obras_estoque"
  | "obras_conta";

export type FeatureGroup = "visao" | "comercial" | "operacao" | "financeiro" | "equipe" | "extras";

/**
 * Os 3 módulos (pilares) do produto. Mesmo conjunto que ModuleId em modules.ts,
 * definido aqui para evitar ciclo de import (modules.ts → permissions.ts → features.ts).
 */
export type FeatureModuleId = "gestao" | "projetos" | "obras";

export type PermissionLevel = "viewer" | "editor";
export type FeatureAccess = PermissionLevel | null;

export type SubscriptionPlanSlug = "starter" | "pro" | "enterprise";

export type FeatureDefinition = {
  key: FeatureKey;
  label: string;
  description: string;
  group: FeatureGroup;
  icon: LucideIcon;
  core: boolean;
  addon: boolean;
  addonPriceLabel?: string;
  dormant?: boolean;
  includedInPlans: readonly SubscriptionPlanSlug[];
  /**
   * Feature-pai (módulo) desta sub-feature. Uma sub-feature só vale se o pai
   * estiver ligado; ausente do JSONB herda o pai (ligado). Ver ADR 0019.
   */
  parent?: FeatureKey;
};

export const FEATURE_GROUP_LABEL: Record<FeatureGroup, string> = {
  visao: "Visão",
  comercial: "Comercial",
  operacao: "Operação",
  financeiro: "Financeiro",
  equipe: "Equipe",
  extras: "Extras",
};

export const FEATURE_GROUP_ORDER: readonly FeatureGroup[] = [
  "visao",
  "comercial",
  "operacao",
  "financeiro",
  "equipe",
  "extras",
];

export const FEATURES: readonly FeatureDefinition[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Visão geral da empresa",
    group: "visao",
    icon: Home,
    core: true,
    addon: false,
    includedInPlans: ["starter", "pro", "enterprise"],
  },
  {
    key: "relatorios",
    label: "Relatórios",
    description: "Relatórios gerenciais e exportações",
    group: "visao",
    icon: BarChart,
    core: false,
    addon: false,
    includedInPlans: ["pro", "enterprise"],
  },
  {
    key: "leads",
    label: "Leads",
    description: "Pipeline comercial e captação",
    group: "comercial",
    icon: UserPlus,
    core: false,
    addon: false,
    includedInPlans: ["pro", "enterprise"],
  },
  {
    key: "propostas",
    label: "Propostas",
    description: "Emissão e gestão de propostas",
    group: "comercial",
    icon: FileText,
    core: false,
    addon: false,
    includedInPlans: ["pro", "enterprise"],
  },
  {
    key: "clientes",
    label: "Clientes",
    description: "Cadastro e relacionamento",
    group: "comercial",
    icon: Building2,
    core: false,
    addon: false,
    includedInPlans: ["starter", "pro", "enterprise"],
  },
  {
    key: "projetos",
    label: "Projetos",
    description: "Escopos, aditivos e entregas",
    group: "operacao",
    icon: Calendar,
    core: false,
    addon: false,
    includedInPlans: ["starter", "pro", "enterprise"],
  },
  {
    key: "mapa",
    label: "Mapa",
    description: "Localização de obras e equipes",
    group: "operacao",
    icon: MapPin,
    core: false,
    addon: false,
    includedInPlans: ["pro", "enterprise"],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description: "Receitas, despesas, fluxo de caixa",
    group: "financeiro",
    icon: Wallet,
    core: false,
    addon: false,
    includedInPlans: ["starter", "pro", "enterprise"],
  },
  {
    key: "pessoas",
    label: "Equipe",
    description: "Gestão de pessoas e cargos",
    group: "equipe",
    icon: Users,
    core: false,
    addon: false,
    includedInPlans: ["starter", "pro", "enterprise"],
  },
  {
    key: "metas",
    label: "Metas",
    description: "Metas financeiras, por pessoa e por projeto, com acompanhamento",
    group: "equipe",
    icon: Target,
    core: false,
    addon: false,
    includedInPlans: ["enterprise"],
  },
  {
    key: "portal_cliente",
    label: "Portal do Cliente",
    description: "Área externa para clientes acompanharem projetos",
    group: "extras",
    icon: Globe,
    core: false,
    addon: false,
    includedInPlans: ["pro", "enterprise"],
  },
  {
    key: "ai_chat",
    label: "Agentes",
    description: "Converse em linguagem natural: os agentes respondem sobre finanças, projetos e comercial",
    group: "visao",
    icon: Sparkles,
    core: false,
    addon: false,
    dormant: false,
    includedInPlans: ["pro", "enterprise"],
  },
  {
    key: "meu_trabalho",
    label: "Meu trabalho",
    description: "Suas disciplinas de projeto e tarefas do dia, num lugar só",
    group: "operacao",
    // core: acesso liberado sem depender do catálogo de features do banco.
    // D1 (spec 008) fica em aberto: os planos serão calibrados depois; até lá
    // a tela fica sempre disponível e a escrita segue gated em 'editor'.
    icon: ListTodo,
    core: true,
    addon: false,
    includedInPlans: ["starter", "pro", "enterprise"],
  },
  {
    key: "obras",
    label: "Obras",
    description: "Execução em campo: diário de obra, frentes e andamento",
    group: "operacao",
    icon: HardHat,
    core: false,
    addon: false,
    // Reaberto em 2026-07-30 (ADR 0011, spec 015). Fica off por padrão e é
    // ligado por empresa (design partner VRZ); por isso não entra em plano ainda.
    includedInPlans: [],
  },
  // Sub-features de Obras (spec 035, ADR 0019). Todas com parent "obras": só
  // valem se o módulo estiver ligado; ausência no JSONB herda o pai (ligado),
  // para não retirar telas de quem já usa Obras. Desligar grava false explícito.
  {
    key: "obras_fornecedores",
    label: "Fornecedores",
    description: "Cadastro de fornecedores da obra",
    group: "operacao",
    icon: Truck,
    core: false,
    addon: false,
    includedInPlans: [],
    parent: "obras",
  },
  {
    key: "obras_clima",
    label: "Clima",
    description: "Previsão do tempo por obra",
    group: "operacao",
    icon: CloudSun,
    core: false,
    addon: false,
    includedInPlans: [],
    parent: "obras",
  },
  {
    key: "obras_diario",
    label: "Diário de obra (RDO)",
    description: "Registro diário: clima, efetivo, atividades e ocorrências",
    group: "operacao",
    icon: ClipboardList,
    core: false,
    addon: false,
    includedInPlans: [],
    parent: "obras",
  },
  {
    key: "obras_cronograma",
    label: "Cronograma da obra",
    description: "Frentes e passos na linha do tempo da execução",
    group: "operacao",
    icon: GanttChartSquare,
    core: false,
    addon: false,
    includedInPlans: [],
    parent: "obras",
  },
  {
    key: "obras_cotacoes",
    label: "Cotações",
    description: "Registrar, comparar e decidir cotações de materiais",
    group: "operacao",
    icon: Scale,
    core: false,
    addon: false,
    includedInPlans: [],
    parent: "obras",
  },
  {
    key: "obras_estoque",
    label: "Estoque",
    description: "Entradas e saídas de materiais da obra",
    group: "operacao",
    icon: Boxes,
    core: false,
    addon: false,
    includedInPlans: [],
    parent: "obras",
  },
  {
    key: "obras_conta",
    label: "Conta da obra",
    description: "Aportes, despesas e prestação de contas por administração",
    group: "operacao",
    icon: Wallet,
    core: false,
    addon: false,
    includedInPlans: [],
    parent: "obras",
  },
  {
    key: "ai_hub",
    label: "IA Hub",
    description: "Assistentes de IA para propostas, relatórios e análises",
    group: "extras",
    icon: Brain,
    core: false,
    addon: true,
    addonPriceLabel: "+R$ 97/mês",
    dormant: true,
    includedInPlans: [],
  },
  {
    key: "capacidade",
    label: "Capacidade",
    description: "Alocação vs disponibilidade do time",
    group: "extras",
    icon: Workflow,
    core: false,
    addon: true,
    addonPriceLabel: "+R$ 49/mês",
    dormant: true,
    includedInPlans: ["enterprise"],
  },
  {
    key: "templates",
    label: "Templates",
    description: "Modelos reutilizáveis de propostas e projetos",
    group: "extras",
    icon: LayoutTemplate,
    core: false,
    addon: true,
    addonPriceLabel: "+R$ 29/mês",
    dormant: true,
    includedInPlans: ["enterprise"],
  },
  {
    key: "timesheet",
    label: "Timesheet",
    description: "Registro de horas por projeto e colaborador",
    group: "operacao",
    icon: Workflow,
    core: false,
    addon: true,
    addonPriceLabel: "+R$ 49/mês",
    dormant: true,
    includedInPlans: ["enterprise"],
  },
];

export const FEATURES_BY_KEY: Record<FeatureKey, FeatureDefinition> = FEATURES.reduce(
  (acc, feature) => {
    acc[feature.key] = feature;
    return acc;
  },
  {} as Record<FeatureKey, FeatureDefinition>
);

/**
 * Módulo (pilar) dono de cada feature. `null` = transversal/plataforma (não
 * pertence a um módulo do switcher: dashboard, relatórios, agentes, add-ons).
 * Record fechado sobre FeatureKey: esquecer uma chave nova quebra o build.
 * Deve refletir a distribuição dos itens em modules.ts (teste de sincronia).
 */
export const FEATURE_MODULE: Record<FeatureKey, FeatureModuleId | null> = {
  // Gestão
  meu_trabalho: "gestao",
  financeiro: "gestao",
  pessoas: "gestao",
  metas: "gestao",
  leads: "gestao",
  clientes: "gestao",
  propostas: "gestao",
  // Projetos
  projetos: "projetos",
  mapa: "projetos",
  // Obras
  obras: "obras",
  obras_fornecedores: "obras",
  obras_clima: "obras",
  obras_diario: "obras",
  obras_cronograma: "obras",
  obras_cotacoes: "obras",
  obras_estoque: "obras",
  obras_conta: "obras",
  // Transversal / plataforma (fora dos 3 pilares)
  dashboard: null,
  relatorios: null,
  portal_cliente: null,
  ai_chat: null,
  ai_hub: null,
  capacidade: null,
  templates: null,
  timesheet: null,
};

/** Módulo dono da feature, ou null se transversal. */
export function moduleOfFeature(key: FeatureKey): FeatureModuleId | null {
  return FEATURE_MODULE[key];
}

/** Sub-features (parent === key), na ordem do catálogo. */
export function subFeaturesOf(parent: FeatureKey): FeatureDefinition[] {
  return FEATURES.filter((f) => f.parent === parent);
}

/** Features "raiz" de um módulo (as que não são sub-feature de outra). */
export function rootFeaturesOfModule(moduleId: FeatureModuleId): FeatureDefinition[] {
  return FEATURES.filter((f) => FEATURE_MODULE[f.key] === moduleId && !f.parent);
}

export type CompanyFeatures = Partial<Record<FeatureKey, boolean>>;
export type UserFeatures = Partial<Record<FeatureKey, PermissionLevel>>;

const VALID_LEVELS: readonly PermissionLevel[] = ["viewer", "editor"];

/**
 * Coerciona JSONB cru de profiles.features para UserFeatures válido.
 * Filtra chaves desconhecidas e valores inválidos. Nunca lança.
 */
export function parseUserFeatures(raw: unknown): UserFeatures {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: UserFeatures = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in FEATURES_BY_KEY)) continue;
    if (typeof value !== "string") continue;
    if (!VALID_LEVELS.includes(value as PermissionLevel)) continue;
    result[key as FeatureKey] = value as PermissionLevel;
  }
  return result;
}

/** Coerciona JSONB cru de empresas.features para CompanyFeatures válido. */
export function parseCompanyFeatures(raw: unknown): CompanyFeatures {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: CompanyFeatures = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in FEATURES_BY_KEY)) continue;
    if (typeof value !== "boolean") continue;
    result[key as FeatureKey] = value;
  }
  return result;
}

const LEVEL_RANK: Record<PermissionLevel, number> = {
  viewer: 1,
  editor: 2,
};

export function meetsLevel(current: FeatureAccess, required: PermissionLevel): boolean {
  if (!current) return false;
  return LEVEL_RANK[current] >= LEVEL_RANK[required];
}

export function groupFeatures(
  features: readonly FeatureDefinition[] = FEATURES
): Record<FeatureGroup, FeatureDefinition[]> {
  const map = FEATURE_GROUP_ORDER.reduce(
    (acc, g) => {
      acc[g] = [];
      return acc;
    },
    {} as Record<FeatureGroup, FeatureDefinition[]>
  );
  for (const f of features) map[f.group].push(f);
  return map;
}

export function isFeatureEnabledForCompany(
  companyFeatures: CompanyFeatures | null | undefined,
  key: FeatureKey
): boolean {
  const feature = FEATURES_BY_KEY[key];
  if (feature?.core) return true;
  // Sub-feature: exige o módulo-pai ligado; ausência no JSONB herda o pai
  // (ligado). Desligar uma sub-feature grava false explícito. Ver ADR 0019.
  if (feature?.parent) {
    if (!isFeatureEnabledForCompany(companyFeatures, feature.parent)) return false;
    return companyFeatures?.[key] !== false;
  }
  return Boolean(companyFeatures?.[key]);
}
