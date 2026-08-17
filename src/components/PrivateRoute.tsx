import { Navigate, useLocation, Outlet, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { supabase } from "@/integrations/supabase/client";
import { isUltraAdmin } from "@/lib/roles";
import { mfaDevBypass } from "@/lib/mfaDevBypass";
import { monitoring } from "@/lib/monitoring";
import Layout from "./Layout";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ULTRA_PLATFORM_MODE_KEY = "ultra_admin_platform_mode";

type SubStatus = "active" | "trialing" | "overdue" | "canceled" | "expired" | null;

// Cache somente em memória — sessionStorage era manipulável via DevTools.
// Objeto mutável: property .v é escrita pelo check(), const no binding.
const subStatusCache: { v: SubStatus | undefined } = { v: undefined };

function SubscriptionSuspendedScreen() {
  const { openSettings } = useSettingsModal();
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-warning-soft">
            <AlertTriangle className="h-10 w-10 text-warning-mid" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-ink">Acesso suspenso</h1>
          <p className="text-ink-muted text-sm leading-relaxed">
            Sua assinatura está suspensa ou cancelada. Regularize o pagamento para retomar o acesso à plataforma.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button variant="brand" onClick={() => openSettings("pagamento")}>
            Ver assinatura
          </Button>
          <Button variant="ghost" asChild className="text-ink-muted">
            <Link to="/" onClick={() => supabase.auth.signOut()}>
              Sair da conta
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PrivateRoute() {
  const { isAuthenticated, profile, loading, mfaChallengeRequired, hasVerifiedMfaFactor } = useAuth();
  const location = useLocation();

  const mfaBypass = mfaDevBypass();
  const [subStatus, setSubStatus] = useState<SubStatus | undefined>(subStatusCache.v);

  useEffect(() => {
    if (!isAuthenticated || subStatus !== undefined) return;

    const check = async () => {
      try {
        const { data } = await (supabase
          .from("pilar_subscriptions" as never)
          .select("status")
          .maybeSingle() as unknown as Promise<{
          data: { status: SubStatus } | null;
          error: unknown;
        }>);
        const s = data?.status ?? null;
        subStatusCache.v = s;
        setSubStatus(s);
      } catch (err) {
        // Erro de infra não deve virar "sem assinatura" (que liberaria uma
        // empresa suspensa). Reporta e NÃO cacheia, para re-checar na próxima
        // navegação em vez de gravar um estado errado. ACH-AUTH-07.
        monitoring.captureException(err, { context: "subscription-gate" });
        setSubStatus(null);
      }
    };
    check();
  }, [isAuthenticated, subStatus]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (mfaChallengeRequired && !mfaBypass && location.pathname !== "/mfa") {
    return <Navigate to="/mfa" replace />;
  }

  if (profile) {
    const isCompanySetup = location.pathname === "/company-setup";
    const isProfileSetup = location.pathname === "/profile-setup";
    const isMfaChallenge = location.pathname === "/mfa";
    const isMfaSetup = location.pathname === "/mfa/setup";
    const profileDone = profile.onboarding_completed === true;
    const companyDone = profile.empresas?.onboarding_completed === true;
    const isAdmin = profile.role === "admin" || profile.role === "ultra_admin";

    if (isMfaChallenge || isMfaSetup) {
      return <Outlet />;
    }

    if (!profileDone && !isProfileSetup) {
      return <Navigate to="/profile-setup" replace />;
    }

    if (profileDone && isAdmin && !companyDone && !isCompanySetup && !isProfileSetup) {
      return <Navigate to="/company-setup" replace />;
    }

    if ((isCompanySetup || isProfileSetup) && profileDone && (!isAdmin || companyDone)) {
      return <Navigate to="/inicio" replace />;
    }

    const onboardingComplete = profileDone && (!isAdmin || companyDone);
    if (onboardingComplete && !hasVerifiedMfaFactor && !mfaBypass && !isMfaSetup) {
      return <Navigate to="/mfa/setup" replace />;
    }
  }

  if (
    location.pathname === "/company-setup" ||
    location.pathname === "/profile-setup" ||
    location.pathname === "/mfa" ||
    location.pathname === "/mfa/setup"
  ) {
    return <Outlet />;
  }

  // Assinatura suspensa bloqueia a app; a própria tela abre o modal de pagamento
  // (montado na raiz, fora das rotas) para o cliente regularizar sem sair daqui.
  const suspended = subStatus === "canceled" || subStatus === "expired";
  if (suspended) {
    return <SubscriptionSuspendedScreen />;
  }

  const justLoggedIn = sessionStorage.getItem("pilar_post_login") === "1";
  if (isUltraAdmin(profile?.role) && justLoggedIn && location.pathname === "/inicio") {
    sessionStorage.removeItem("pilar_post_login");
    sessionStorage.setItem(ULTRA_PLATFORM_MODE_KEY, "true");
    return <Navigate to="/ultra-admin" replace />;
  }

  return <Layout />;
}
