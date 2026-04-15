import { Navigate, Outlet } from "react-router-dom";
import { useClienteAuth } from "@/pages/cliente/useClienteAuth";
import { Loader2 } from "lucide-react";

export function ClientePrivateRoute() {
  const { account, loading, error } = useClienteAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !account) {
    return <Navigate to="/cliente/login" replace />;
  }

  return <Outlet context={account} />;
}
