import {
  BarChart,
  Brain,
  Building2,
  Calendar,
  Clock,
  FileText,
  Gauge,
  Globe,
  Home,
  LayoutTemplate,
  MapPin,
  Target,
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
  | "planejamento"
  | "timesheet"
  | "mapa"
  | "financeiro"
  | "pessoas"
  | "metas"
  | "portal_cliente"
  | "ai_hub"
  | "capacidade"
  | "templates";

export type FeatureGroup = "visao" | "comercial" | "operacao" | "financeiro" | "equipe" | "extras";

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
    key: "planejamento",
    label: "Planejamento",
    description: "Cronograma e alocação",
    group: "operacao",
    icon: Gauge,
    core: false,
    addon: false,
    includedInPlans: ["pro", "enterprise"],
  },
  {
    key: "timesheet",
    label: "Timesheet",
    description: "Lançamento de horas",
    group: "operacao",
    icon: Clock,
    core: false,
    addon: false,
    includedInPlans: ["pro", "enterprise"],
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
    description: "Metas individuais e por equipe",
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
];

export const FEATURES_BY_KEY: Record<FeatureKey, FeatureDefinition> = FEATURES.reduce(
  (acc, feature) => {
    acc[feature.key] = feature;
    return acc;
  },
  {} as Record<FeatureKey, FeatureDefinition>
);

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
  return Boolean(companyFeatures?.[key]);
}
