import { Navigate, Outlet } from "react-router-dom";

import { useCampoAuth, type CampoAccount } from "@/pages/campo/useCampoAuth";

import { EntryVeil } from "@/components/motion/EntryVeil";

/**
 * Protege as rotas do Pilar Campo: verifica o token de campo. Sem sessão → login;
 * com sessão mas senha provisória → troca de senha; ok → passa a conta adiante
 * via Outlet context.
 */
export function CampoPrivateRoute() {
  const { account, loading, error } = useCampoAuth();

  if (loading) {
    return <EntryVeil label="Abrindo o Pilar Campo" />;
  }

  if (error || !account) {
    return <Navigate to="/campo/login" replace />;
  }

  if (account.must_change_senha) {
    return <Navigate to="/campo/senha" replace />;
  }

  return <Outlet context={{ account } satisfies { account: CampoAccount }} />;
}
