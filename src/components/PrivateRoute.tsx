import { Navigate, useLocation, Outlet, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isUltraAdmin } from "@/lib/roles";
import Layout from "./Layout";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ULTRA_PLATFORM_MODE_KEY = "ultra_admin_platform_mode";

type SubStatus = "active" | "trialing" | "overdue" | "canceled" | "expired" | null;

const SUB_CACHE_KEY = "pilar-sub-status";
const SUB_CACHE_TTL = 5 * 60 * 1000; // 5 min

function readCachedStatus(): SubStatus | undefined {
  try {
    const raw = sessionStorage.getItem(SUB_CACHE_KEY);
    if (!raw) return undefined;
    const { status, ts } = JSON.parse(raw) as { status: SubStatus; ts: number };
    if (Date.now() - ts > SUB_CACHE_TTL) return undefined;
    return status;
  } catch {
    return undefined;
  }
}

function writeCachedStatus(status: SubStatus) {
  try {
    sessionStorage.setItem(SUB_CACHE_KEY, JSON.stringify({ status, ts: Date.now() }));
  } catch {
    // ignore
  }
}

function SubscriptionSuspendedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-amber-100">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Acesso suspenso</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Sua assinatura está suspensa ou cancelada. Regularize o pagamento para retomar o acesso à plataforma.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild className="bg-accent-orange hover:bg-accent-orange/90 text-ink">
            <Link to="/billing">Ver assinatura</Link>
          </Button>
          <Button variant="ghost" asChild className="text-slate-500">
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
  const [subStatus, setSubStatus] = useState<SubStatus | undefined>(readCachedStatus());

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
        setSubStatus(s);
        writeCachedStatus(s);
      } catch {
        setSubStatus(null);
        writeCachedStatus(null);
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

  if (mfaChallengeRequired && location.pathname !== "/mfa") {
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
      return <Navigate to="/dashboard" replace />;
    }

    const onboardingComplete = profileDone && (!isAdmin || companyDone);
    if (onboardingComplete && !hasVerifiedMfaFactor && !isMfaSetup) {
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

  const suspended = subStatus === "canceled" || subStatus === "expired";
  const isBillingPath = location.pathname.startsWith("/billing");
  if (suspended && !isBillingPath) {
    return <SubscriptionSuspendedScreen />;
  }

  const justLoggedIn = sessionStorage.getItem("pilar_post_login") === "1";
  if (isUltraAdmin(profile?.role) && justLoggedIn && location.pathname === "/dashboard") {
    sessionStorage.removeItem("pilar_post_login");
    sessionStorage.setItem(ULTRA_PLATFORM_MODE_KEY, "true");
    return <Navigate to="/ultra-admin" replace />;
  }

  return <Layout />;
}
