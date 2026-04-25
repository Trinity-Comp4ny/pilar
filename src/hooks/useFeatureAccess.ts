import { useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { FeatureKey, PermissionLevel } from "@/lib/features";
import type { Feature } from "@/lib/permissions";

export type FeatureAccessResult = {
  /** True se o user pode no mínimo visualizar a feature. */
  canView: boolean;
  /** True se o user pode editar (criar/atualizar/excluir). */
  canEdit: boolean;
  /** True se o user é viewer mas não editor. */
  isViewerOnly: boolean;
  /** Nível efetivo do user (null se sem acesso). admin/ultra_admin retornam 'editor'. */
  level: PermissionLevel | null;
  /** True quando role é admin/ultra_admin (bypass). */
  isAdmin: boolean;
};

/**
 * Hook de checagem por feature individual. Para várias features, usar usePermissions().can.
 *
 * @example
 *   const { canEdit, isViewerOnly } = useFeatureAccess("projetos");
 *   const { canView } = useFeatureAccess("ai_hub");
 */
export function useFeatureAccess(feature: FeatureKey): FeatureAccessResult {
  const { can, isAdmin, userFeatures } = usePermissions();

  return useMemo(() => {
    const f = feature as Feature;
    const canView = can(f, "view");
    const canEdit = can(f, "edit");

    let level: PermissionLevel | null = null;
    if (isAdmin) {
      level = "editor";
    } else if (userFeatures[feature]) {
      level = userFeatures[feature] ?? null;
    } else if (canView) {
      level = "viewer";
    }

    return {
      canView,
      canEdit,
      isViewerOnly: canView && !canEdit,
      level,
      isAdmin,
    };
  }, [feature, can, isAdmin, userFeatures]);
}
