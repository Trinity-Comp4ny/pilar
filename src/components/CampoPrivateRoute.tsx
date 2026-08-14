import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCampoAuth, type CampoAccount } from "@/pages/campo/useCampoAuth";

/**
 * Protege as rotas do Pilar Campo: verifica o token de campo. Sem sessão → login;
 * com sessão mas senha provisória → troca de senha; ok → passa a conta adiante
 * via Outlet context.
 */
export function CampoPrivateRoute() {
  const { account, loading, error } = useCampoAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !account) {
    return <Navigate to="/campo/login" replace />;
  }

  if (account.must_change_senha) {
    return <Navigate to="/campo/senha" replace />;
  }

  return <Outlet context={{ account } satisfies { account: CampoAccount }} />;
}
