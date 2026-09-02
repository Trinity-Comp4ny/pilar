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
  /** Nível efetivo (null se sem acesso). Membro da empresa é 'editor' (ADR 0029). */
  level: PermissionLevel | null;
  /** True quando role é admin/ultra_admin (bypass). */
  isAdmin: boolean;
};

/**
 * Hook de checagem por feature individual. Para várias features, usar usePermissions().can.
 *
 * @example
 *   const { canEdit, isViewerOnly } = useFeatureAccess("projetos");
 *   const { canView } = useFeatureAccess("timesheet");
 */
export function useFeatureAccess(feature: FeatureKey): FeatureAccessResult {
  const { can, isAdmin } = usePermissions();

  return useMemo(() => {
    const f = feature as Feature;
    const canView = can(f, "view");
    const canEdit = can(f, "edit");

    const level: PermissionLevel | null = canEdit ? "editor" : canView ? "viewer" : null;

    return {
      canView,
      canEdit,
      isViewerOnly: canView && !canEdit,
      level,
      isAdmin,
    };
  }, [feature, can, isAdmin]);
}
