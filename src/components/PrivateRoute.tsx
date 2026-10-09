import { Navigate, useLocation, Outlet, Link } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { supabase } from "@/integrations/supabase/client";
import { isUltraAdmin } from "@/lib/roles";
import { mfaDevBypass } from "@/lib/mfaDevBypass";
import { statusDeAcesso } from "@/lib/cobranca";
import { monitoring } from "@/lib/monitoring";
import Layout from "./Layout";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const AccountRecoveryScreen = lazy(() =>
  import("./AccountRecoveryScreen").then(({ AccountRecoveryScreen }) => ({ default: AccountRecoveryScreen }))
);

export const ULTRA_PLATFORM_MODE_KEY = "ultra_admin_platform_mode";

type SubStatus = "active" | "trialing" | "overdue" | "canceled" | "expired" | null;

// Cache somente em memória — sessionStorage era manipulável via DevTools.
const subStatusCache = new Map<string, SubStatus>();

// SPEC 098: quem não pode regularizar a assinatura (não é admin) não vê o
// atalho pra tela de pagamento, que ele não tem acesso mesmo. Só orienta a
// falar com quem administra a empresa.
function SubscriptionSuspendedScreen({ isAdmin }: { isAdmin: boolean }) {
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
            {isAdmin
              ? "Sua assinatura está suspensa ou cancelada. Regularize o pagamento para retomar o acesso à plataforma."
              : "A assinatura da sua empresa está suspensa ou cancelada. Fale com o administrador da sua empresa para regularizar o pagamento."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {isAdmin && (
            <Button variant="brand" onClick={() => openSettings("pagamento")}>
              Ver assinatura
            </Button>
          )}
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
  const { isAuthenticated, profile, loading, mfaChallengeRequired } = useAuth();
  const location = useLocation();

  const mfaBypass = mfaDevBypass();
  const empresaId = profile?.empresa_id;
  const [subscription, setSubscription] = useState<{ empresaId: string; status: SubStatus } | null>(null);
  const subStatus = empresaId
    ? subscription?.empresaId === empresaId
      ? subscription.status
      : subStatusCache.get(empresaId)
    : undefined;

  useEffect(() => {
    if (!isAuthenticated || !empresaId || loading || (mfaChallengeRequired && !mfaBypass) || subStatus !== undefined)
      return;
    let active = true;
    const check = async () => {
      try {
        const { data, error } = await (supabase
          .from("pilar_subscriptions" as never)
          .select("status, current_period_end")
          .eq("empresa_id", empresaId)
          .maybeSingle() as unknown as Promise<{
          data: { status: SubStatus; current_period_end: string | null } | null;
          error: unknown;
        }>);
        if (error) throw error;
        if (!active) return;
        const status = statusDeAcesso(data) as SubStatus;
        subStatusCache.set(empresaId, status);
        setSubscription({ empresaId, status });
      } catch (error) {
        monitoring.captureException(error, { context: "subscription-gate" });
        // Mantém o comportamento de falha transitória sem cachear o resultado.
        if (active) setSubscription({ empresaId, status: null });
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [isAuthenticated, empresaId, loading, mfaChallengeRequired, mfaBypass, subStatus]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (mfaChallengeRequired && !mfaBypass && location.pathname !== "/mfa") {
    return <Navigate to="/mfa" replace />;
  }

  if (location.pathname === "/mfa") return <Outlet />;

  if (!profile) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
        <AccountRecoveryScreen />
      </Suspense>
    );
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

    // MFA é opcional (ADR 0031): ninguém é empurrado para /mfa/setup antes de
    // usar o produto. A ativação vive em Configurações > Segurança.
  }

  if (
    location.pathname === "/company-setup" ||
    location.pathname === "/profile-setup" ||
    location.pathname === "/mfa" ||
    location.pathname === "/mfa/setup"
  ) {
    return <Outlet />;
  }

  if (empresaId && subStatus === undefined) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  // SPEC 098 Fase 3 (ADR 0042): trial vencido sem cartão tokenizado entra em
  // 90 dias de somente leitura antes da exclusão, em vez de bloquear o
  // acesso por completo — distinto de cancelamento/inadimplência abaixo.
  // leitura_desde é a fonte de verdade (setada pelo trial-expiry-cron);
  // sem ela, "expired" ainda cai no bloqueio total de sempre.
  const leituraDesde = profile?.empresas?.leitura_desde ?? null;
  const emLeitura = subStatus === "expired" && leituraDesde !== null;

  // Assinatura suspensa bloqueia a app; a própria tela abre o modal de pagamento
  // (montado na raiz, fora das rotas) para o cliente regularizar sem sair daqui.
  const suspended = subStatus === "canceled" || (subStatus === "expired" && !emLeitura);
  if (suspended) {
    const isAdmin = profile?.role === "admin" || profile?.role === "ultra_admin";
    return <SubscriptionSuspendedScreen isAdmin={isAdmin} />;
  }

  const justLoggedIn = sessionStorage.getItem("pilar_post_login") === "1";
  if (isUltraAdmin(profile?.role) && justLoggedIn && location.pathname === "/inicio") {
    sessionStorage.removeItem("pilar_post_login");
    sessionStorage.setItem(ULTRA_PLATFORM_MODE_KEY, "true");
    return <Navigate to="/ultra-admin" replace />;
  }

  if (emLeitura) {
    const isAdmin = profile?.role === "admin" || profile?.role === "ultra_admin";
    return (
      <>
        <ReadOnlyBanner isAdmin={isAdmin} />
        <Layout />
      </>
    );
  }

  return <Layout />;
}
