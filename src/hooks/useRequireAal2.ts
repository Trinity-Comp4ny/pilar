import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { mfaDevBypass } from "@/lib/mfaDevBypass";

/**
 * Gate for sensitive mutations (invite user, reset portal password, role change, delete).
 *
 * Usage:
 *   const requireAal2 = useRequireAal2();
 *   async function onInvite() {
 *     if (!(await requireAal2())) return;
 *     await inviteUser(...);
 *   }
 *
 * MFA é opcional (ADR 0031): quem não tem fator enrolado passa direto, senão o
 * gate viraria uma exigência de ativar 2FA disfarçada. Quem tem fator e está
 * numa sessão AAL1 confirma o código antes de seguir.
 */
export function useRequireAal2() {
  const { mfaCurrentLevel, mfaNextLevel } = useAuth();
  const navigate = useNavigate();

  return useCallback(async (): Promise<boolean> => {
    if (mfaDevBypass()) return true;
    if (mfaCurrentLevel === "aal2") return true;

    // Sem fator enrolado: MFA é opcional, a ação segue.
    if (mfaNextLevel !== "aal2") return true;

    toast.error("Confirme o código de verificação", {
      description: "Sua conta tem 2FA ativo. Confirme o código para continuar.",
    });
    navigate("/mfa", { state: { reason: "aal2-required", returnTo: window.location.pathname } });
    return false;
  }, [mfaCurrentLevel, mfaNextLevel, navigate]);
}
