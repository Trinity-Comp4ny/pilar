import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

export function AdminRoute() {
  const { loading, mfaCurrentLevel } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!can("admin_portal", "view")) {
    return <Navigate to="/sem-acesso?recurso=admin_portal" replace />;
  }

  if (mfaCurrentLevel !== "aal2") {
    return <Navigate to="/mfa" replace state={{ from: location, reason: "aal2-required" }} />;
  }

  return <Outlet />;
}
