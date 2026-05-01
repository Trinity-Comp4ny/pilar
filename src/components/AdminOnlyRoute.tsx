import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

export function AdminOnlyRoute() {
  const { loading } = useAuth();
  const { isAdmin } = usePermissions();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/sem-acesso?recurso=admin_portal" replace />;
  }

  return <Outlet />;
}
