import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isUltraAdmin } from "@/lib/roles";

export function UltraAdminRoute() {
  const { loading, profile, mfaCurrentLevel } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  }

  if (!isUltraAdmin(profile?.role)) {
    return <Navigate to="/sem-acesso?recurso=ultra_admin" replace />;
  }

  if (mfaCurrentLevel !== "aal2") {
    return <Navigate to="/mfa" replace state={{ from: location, reason: "aal2-required" }} />;
  }

  return <Outlet />;
}
