import { useContext, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ImpersonationContext } from "@/contexts/ImpersonationContext";
import { canDo, reasonFor, type Action, type Feature, type UserRole } from "@/lib/permissions";
import { parseCompanyFeatures, parseUserFeatures } from "@/lib/features";

type ButtonProps = {
  disabled: boolean;
  title: string;
  "aria-disabled": boolean;
};

type NavItemProps = {
  disabled: boolean;
  title: string;
};

export function usePermissions() {
  const { profile } = useAuth();
  const impersonation = useContext(ImpersonationContext);

  const realRole = (profile?.role ?? null) as UserRole | null;
  const effectiveRole =
    impersonation?.viewAsRole && (realRole === "admin" || realRole === ("ultra_admin" as UserRole))
      ? impersonation.viewAsRole
      : realRole;

  const userFeatures = useMemo(
    () => parseUserFeatures((profile as { features?: unknown } | null)?.features),
    [profile]
  );

  const companyFeatures = useMemo(
    () => parseCompanyFeatures((profile as { empresas?: { features?: unknown } | null } | null)?.empresas?.features),
    [profile]
  );

  return useMemo(() => {
    const ctx = { role: effectiveRole, userFeatures, companyFeatures };

    const can = (feature: Feature, action: Action = "view") => canDo(ctx, feature, action);
    const cannot = (feature: Feature, action: Action = "view") => !can(feature, action);

    const getButtonProps = (feature: Feature, action: Action = "edit"): ButtonProps => {
      const ok = can(feature, action);
      return {
        disabled: !ok,
        title: ok ? "" : reasonFor(feature, action),
        "aria-disabled": !ok,
      };
    };

    const getNavItemProps = (feature: Feature): NavItemProps => {
      const ok = can(feature, "view");
      return {
        disabled: !ok,
        title: ok ? "" : reasonFor(feature, "view"),
      };
    };

    return {
      role: effectiveRole,
      realRole,
      isImpersonating: impersonation?.isImpersonating ?? false,
      isAdmin: effectiveRole === "admin" || effectiveRole === ("ultra_admin" as UserRole),
      isUltraAdmin: effectiveRole === ("ultra_admin" as UserRole),
      userFeatures,
      companyFeatures,
      can,
      cannot,
      getButtonProps,
      getNavItemProps,
    };
  }, [effectiveRole, realRole, impersonation?.isImpersonating, userFeatures, companyFeatures]);
}
