import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { mfaDevBypass } from "@/lib/mfaDevBypass";

/**
 * Step-up: exige sessão AAL2 (MFA verificado nesta sessão).
 *
 * Comportamento:
 *  - Se não tem fator MFA → /mfa/setup
 *  - Se tem fator mas sessão é AAL1 → /mfa (challenge), preservando rota de retorno
 *  - Se já AAL2 → libera o Outlet
 */
export function RequireAal2() {
  const { loading, mfaCurrentLevel, mfaNextLevel, hasVerifiedMfaFactor } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  // Dev local (banco local): libera sem MFA. Inerte em staging/prod.
  if (mfaDevBypass()) {
    return <Outlet />;
  }

  if (!hasVerifiedMfaFactor) {
    return <Navigate to="/mfa/setup" replace state={{ from: location }} />;
  }

  const stepUpNeeded = mfaCurrentLevel !== "aal2" && mfaNextLevel === "aal2";
  if (stepUpNeeded) {
    return <Navigate to="/mfa" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
