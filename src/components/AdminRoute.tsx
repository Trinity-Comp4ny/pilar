import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

import { PageLoader } from "@/components/motion/PageLoader";
/**
 * Admin da empresa não precisa de MFA para administrar a própria empresa
 * (ADR 0031): segundo fator obrigatório ficou só no acesso cross-tenant do
 * ultra-admin. Quem tem 2FA ativo ainda passa pelo gate nas ações sensíveis
 * (useRequireAal2).
 */
export function AdminRoute() {
  const { loading } = useAuth();
  const { can } = usePermissions();

  if (loading) {
    return <PageLoader size="page" />;
  }

  if (!can("admin_portal", "view")) {
    return <Navigate to="/sem-acesso?recurso=admin_portal" replace />;
  }

  return <Outlet />;
}
