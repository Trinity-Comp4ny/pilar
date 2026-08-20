import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isUltraAdmin } from "@/lib/roles";
import { mfaDevBypass } from "@/lib/mfaDevBypass";

/**
 * MFA é opcional no produto (ADR 0031), com uma exceção: o ultra-admin lê e
 * escreve em todas as empresas, então aqui o segundo fator continua obrigatório.
 * Sem fator enrolado o caminho é o setup, não o desafio.
 */
export function UltraAdminRoute() {
  const { loading, profile, mfaCurrentLevel, mfaNextLevel } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  }

  if (!isUltraAdmin(profile?.role)) {
    return <Navigate to="/sem-acesso?recurso=ultra_admin" replace />;
  }

  if (!mfaDevBypass() && mfaCurrentLevel !== "aal2") {
    const target = mfaNextLevel === "aal2" ? "/mfa" : "/mfa/setup";
    return <Navigate to={target} replace state={{ from: location, reason: "aal2-required" }} />;
  }

  return <Outlet />;
}
