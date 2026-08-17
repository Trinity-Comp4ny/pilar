import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
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
 * Returns a function that resolves true if the session is at AAL2.
 * If not, shows a toast and redirects to the appropriate page (mfa-challenge or profile for enroll).
 */
export function useRequireAal2() {
  const { mfaCurrentLevel, mfaNextLevel } = useAuth();
  const navigate = useNavigate();
  const { openSettings } = useSettingsModal();

  return useCallback(async (): Promise<boolean> => {
    if (mfaDevBypass()) return true;
    if (mfaCurrentLevel === "aal2") return true;

    const needsEnroll = mfaNextLevel !== "aal2";

    toast.error("Verificação em duas etapas necessária", {
      description: needsEnroll
        ? "Ative o 2FA na aba Segurança antes de executar esta ação."
        : "Confirme seu código 2FA para continuar.",
    });

    if (needsEnroll) {
      // O enroll de 2FA vive na aba Segurança do modal de configurações.
      openSettings("seguranca");
    } else {
      navigate("/mfa", { state: { reason: "aal2-required", returnTo: window.location.pathname } });
    }
    return false;
  }, [mfaCurrentLevel, mfaNextLevel, navigate, openSettings, toast]);
}
