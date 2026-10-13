import { Suspense, lazy } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useClienteAuth } from "@/hooks/useClienteAuth";

import { EntryVeil } from "@/components/motion/EntryVeil";

// Sob demanda: a tela só aparece para cliente com senha temporária, e importada
// direto ela levava react-hook-form e todos os schemas para o boot de todo usuário.
const ForcarTrocaSenha = lazy(() => import("@/pages/cliente/ForcarTrocaSenha"));

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
    return (
      <Suspense fallback={<EntryVeil label="Abrindo o portal" />}>
        <ForcarTrocaSenha onSuccess={refresh} />
      </Suspense>
    );
  }

  return <Outlet context={account} />;
}
