import { Navigate, Outlet } from "react-router-dom";
import { useClienteAuth } from "@/hooks/useClienteAuth";

import ForcarTrocaSenha from "@/pages/cliente/ForcarTrocaSenha";

import { EntryVeil } from "@/components/motion/EntryVeil";

export function ClientePrivateRoute() {
  const { account, loading, error, refresh } = useClienteAuth();

  if (loading) {
    return <EntryVeil label="Abrindo o portal" />;
  }

  if (error || !account) {
    // Sinaliza sessão expirada pro login mostrar o motivo, em vez de jogar o
    // cliente pra tela de login sem explicação.
    const reason = error === "session_expired" ? "expired" : undefined;
    return <Navigate to="/cliente/login" replace state={{ reason }} />;
  }

  // Senha temporária (convite/reset): bloqueia todo o portal até o cliente trocar.
  // Após a troca, refresh revalida a sessão (must_change_password = false) e libera.
  if (account.must_change_password) {
    return <ForcarTrocaSenha onSuccess={refresh} />;
  }

  return <Outlet context={account} />;
}
