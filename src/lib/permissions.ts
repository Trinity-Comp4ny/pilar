import type { Database } from "@/integrations/supabase/types";
import { FEATURES_BY_KEY, type CompanyFeatures, type FeatureKey, isFeatureEnabledForCompany } from "@/lib/features";

export type UserRole = Database["public"]["Enums"]["user_role"];

export const ROLE_LABEL: Record<string, string> = {
  ultra_admin: "Ultra Admin",
  admin: "Admin",
  user: "Usuário",
  // Roles de contrato (modelo atual)
  owner: "Dono",
  coordenador: "Coordenador",
  colaborador: "Colaborador",
  // Legados (backfilled para 'user' na migration; ficam aqui só para
  // exibição se algum registro residual aparecer)
  financeiro: "Financeiro",
  marketing: "Marketing",
  operacional: "Operacional",
  editor: "Editor",
  viewer: "Viewer",
};

/**
 * Feature mantém o mesmo nome do tipo legado; passa a ser equivalente a FeatureKey.
 * 'admin_portal', 'billing' e 'financeiro_folha' são pseudo-features controladas
 * por role, não pelo catálogo.
 */
export type Feature = FeatureKey | "admin_portal" | "billing" | "financeiro_folha";
export type Action = "view" | "create" | "edit" | "delete" | "manage";

type AccessContext = {
  role: UserRole | null | undefined;
  companyFeatures: CompanyFeatures;
  /** ADR 0034: concessão pontual de financeiro geral, independente do role. */
  financeiroDelegado?: boolean | null;
  /** Extensão do ADR 0034: mesma concessão pontual, para equipe e metas. */
  equipeDelegado?: boolean | null;
  metasDelegado?: boolean | null;
};

/** Features que só admin usa por padrão; coordenador precisa de concessão explícita (nunca "user"). */
const DELEGABLE_FEATURES = ["financeiro", "pessoas", "metas"] as const;
type DelegableFeature = (typeof DELEGABLE_FEATURES)[number];

function isDelegableFeature(feature: Feature): feature is DelegableFeature {
  return (DELEGABLE_FEATURES as readonly string[]).includes(feature);
}

function delegadoFor(ctx: AccessContext, feature: DelegableFeature): boolean {
  if (feature === "financeiro") return Boolean(ctx.financeiroDelegado);
  if (feature === "pessoas") return Boolean(ctx.equipeDelegado);
  return Boolean(ctx.metasDelegado);
}

/**
 * Verifica acesso: role + módulo habilitado na empresa. Mesma regra que a RLS
 * aplica em user_has_feature, para a UI não oferecer o que o banco nega (ADR 0029).
 * - ultra_admin: bypass total (plataforma).
 * - membro da empresa: lê e escreve no que a empresa tem habilitado. `action`
 *   fica na assinatura porque as telas passam, e para um RBAC por role no futuro.
 * - sem role: nada.
 *
 * 'financeiro', 'pessoas' (Equipe) e 'metas' são exceção: não passam pelo
 * toggle de módulo da empresa — decidem por role + concessão pontual ao
 * coordenador (ADR 0034 e sua extensão), igual can_view_financeiro() no
 * banco. Um "user" nunca recebe essas três, só admin ou coordenador com
 * concessão.
 */
export function canDo(ctx: AccessContext | null, feature: Feature, _action: Action = "view"): boolean {
  if (!ctx) return false;
  const { role } = ctx;
  if (!role) return false;

  // Pseudo-features controladas por role, não pelo catálogo.
  if (feature === "admin_portal" || feature === "billing" || feature === "financeiro_folha") {
    return (role as string) === "ultra_admin" || role === "admin";
  }

  if ((role as string) === "ultra_admin") return true;

  if (isDelegableFeature(feature)) {
    return role === "admin" || (role === "coordenador" && delegadoFor(ctx, feature));
  }

  const isCore = FEATURES_BY_KEY[feature]?.core ?? false;
  if (!isCore && !isFeatureEnabledForCompany(ctx.companyFeatures, feature)) {
    return false;
  }

  return true;
}

export function reasonFor(feature: Feature, _action: Action = "view"): string {
  if (feature === "admin_portal" || feature === "billing" || feature === "financeiro_folha") {
    return "Requer perfil Admin ou Ultra Admin";
  }
  if (feature === "financeiro") {
    return "Requer perfil Admin ou acesso financeiro concedido por um administrador";
  }
  if (feature === "pessoas") {
    return "Requer perfil Admin ou acesso de equipe concedido por um administrador";
  }
  if (feature === "metas") {
    return "Requer perfil Admin ou acesso a metas concedido por um administrador";
  }
  return `${FEATURES_BY_KEY[feature]?.label ?? feature} não está habilitado para esta empresa`;
}

/** Retrocompat: matriz não é mais a fonte da verdade, retorna lista vazia. */
export function allowedRolesFor(_feature: Feature, _action: Action = "view"): readonly UserRole[] {
  return [];
}
