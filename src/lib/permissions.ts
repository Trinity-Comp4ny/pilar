import type { Database } from "@/integrations/supabase/types";
import {
  FEATURES_BY_KEY,
  type CompanyFeatures,
  type FeatureKey,
  type PermissionLevel,
  type UserFeatures,
  isFeatureEnabledForCompany,
  meetsLevel,
} from "@/lib/features";

export type UserRole = Database["public"]["Enums"]["user_role"];

export const ROLE_LABEL: Record<string, string> = {
  ultra_admin: "Ultra Admin",
  admin: "Admin",
  user: "Usuário",
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
 * 'admin_portal' e 'billing' são pseudo-features controladas por role, não pelo catálogo.
 */
export type Feature = FeatureKey | "admin_portal" | "billing";
export type Action = "view" | "create" | "edit" | "delete" | "manage";

/**
 * Mapeia ação → nível mínimo necessário em profiles.features.
 *   view              → viewer
 *   create/edit/delete/manage → editor
 */
function actionToLevel(action: Action): PermissionLevel {
  return action === "view" ? "viewer" : "editor";
}

type AccessContext = {
  role: UserRole | null | undefined;
  userFeatures: UserFeatures;
  companyFeatures: CompanyFeatures;
};

/**
 * Verifica acesso considerando role + empresa.features + profile.features.
 * - ultra_admin: bypass total.
 * - admin: bypass dentro da empresa (precisa empresa ter feature ligada,
 *   exceto para 'dashboard' que é core).
 * - user/legados: precisa nível suficiente em profile.features.
 */
export function canDo(ctx: AccessContext | null, feature: Feature, action: Action = "view"): boolean {
  if (!ctx) return false;
  const { role } = ctx;
  if (!role) return false;

  // Pseudo-features
  if (feature === "admin_portal" || feature === "billing") {
    return (role as string) === "ultra_admin" || role === "admin";
  }

  if ((role as string) === "ultra_admin") return true;

  const isCore = FEATURES_BY_KEY[feature]?.core ?? false;
  if (!isCore && !isFeatureEnabledForCompany(ctx.companyFeatures, feature)) {
    return false;
  }

  if (role === "admin") return true;

  const minLevel = actionToLevel(action);
  const current = ctx.userFeatures[feature];

  if (current) return meetsLevel(current, minLevel);

  // Core (dashboard) sempre dá viewer mesmo sem entrada explícita
  if (isCore && minLevel === "viewer") return true;

  return false;
}

export function reasonFor(feature: Feature, action: Action = "view"): string {
  const minLevel = actionToLevel(action);
  if (feature === "admin_portal" || feature === "billing") {
    return "Requer perfil Admin ou Ultra Admin";
  }
  return `Requer ${minLevel === "editor" ? "Editor" : "Viewer ou Editor"} em ${
    FEATURES_BY_KEY[feature]?.label ?? feature
  }`;
}

/** Retrocompat: matriz não é mais a fonte da verdade, retorna lista vazia. */
export function allowedRolesFor(_feature: Feature, _action: Action = "view"): readonly UserRole[] {
  return [];
}
