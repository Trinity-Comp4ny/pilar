import { useContext, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ImpersonationContext } from "@/contexts/ImpersonationContext";
import { canDo, reasonFor, type Action, type Feature, type UserRole } from "@/lib/permissions";
import { moduleOfFeature, parseCompanyFeatures, type FeatureKey } from "@/lib/features";
import { parseModulosOcultos, type ModuleId } from "@/lib/modules";

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

  const companyFeatures = useMemo(
    () => parseCompanyFeatures((profile as { empresas?: { features?: unknown } | null } | null)?.empresas?.features),
    [profile]
  );

  // ADR 0066: módulos ocultos = união da lista da empresa com a do usuário.
  // Gate de experiência, não de dados. Admin nunca é restringido (checado no useMemo).
  const modulosOcultosBrutos = useMemo(
    () => [
      ...parseModulosOcultos((profile as { empresas?: { modulos_ocultos?: unknown } | null } | null)?.empresas?.modulos_ocultos),
      ...parseModulosOcultos((profile as { modulos_ocultos?: unknown } | null)?.modulos_ocultos),
    ],
    [profile]
  );

  // ADR 0034 (e sua extensão para equipe/metas): concessão é do PRÓPRIO
  // usuário (não muda com impersonation de role, que só troca a hierarquia
  // simulada).
  const financeiroDelegado = Boolean((profile as { financeiro_delegado?: boolean } | null)?.financeiro_delegado);
  const equipeDelegado = Boolean((profile as { equipe_delegado?: boolean } | null)?.equipe_delegado);
  const metasDelegado = Boolean((profile as { metas_delegado?: boolean } | null)?.metas_delegado);

  return useMemo(() => {
    const ctx = { role: effectiveRole, companyFeatures, financeiroDelegado, equipeDelegado, metasDelegado };

    const isAdminRole = effectiveRole === "admin" || effectiveRole === ("ultra_admin" as UserRole);
    const modulosOcultos: ModuleId[] = isAdminRole ? [] : Array.from(new Set(modulosOcultosBrutos));
    const moduloVisivel = (id: ModuleId) => !modulosOcultos.includes(id);

    // ADR 0066: feature de módulo oculto some para quem não vê o módulo (menu, painel, onboarding, rota).
    const can = (feature: Feature, action: Action = "view") => {
      const modulo = moduleOfFeature(feature as FeatureKey);
      if (modulo && !moduloVisivel(modulo)) return false;
      return canDo(ctx, feature, action);
    };
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
      modulosOcultos,
      moduloVisivel,
      role: effectiveRole,
      realRole,
      isImpersonating: impersonation?.isImpersonating ?? false,
      isAdmin: effectiveRole === "admin" || effectiveRole === ("ultra_admin" as UserRole),
      isUltraAdmin: effectiveRole === ("ultra_admin" as UserRole),
      companyFeatures,
      // Admin com impersonation ainda hidratando do servidor: o papel efetivo
      // pode mudar. Query que chama RPC com gate de papel espera `ready`, senão
      // o banco (que já vê o papel simulado) rejeita (PILAR-2C/2D).
      ready: !impersonation?.loading,
      can,
      cannot,
      getButtonProps,
      getNavItemProps,
    };
  }, [
    effectiveRole,
    realRole,
    impersonation?.isImpersonating,
    impersonation?.loading,
    companyFeatures,
    modulosOcultosBrutos,
    financeiroDelegado,
    equipeDelegado,
    metasDelegado,
  ]);
}
