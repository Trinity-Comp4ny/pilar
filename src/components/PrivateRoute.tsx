import { Navigate, useLocation, Outlet } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isUltraAdmin } from "@/lib/roles";
import { mfaDevBypass } from "@/lib/mfaDevBypass";
import { statusDeAcesso } from "@/lib/cobranca";
import { monitoring } from "@/lib/monitoring";
import { autorizacaoPendente, rotaDeAutorizacao } from "@/lib/oauthPendente";
import Layout from "./Layout";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { EVENTO_ASSINATURA_SUSPENSA } from "@/lib/assinaturaSuspensa";
import { EntryVeil } from "@/components/motion/EntryVeil";
import { useEntradaPronta } from "@/hooks/useEntradaPronta";

const AccountRecoveryScreen = lazy(() =>
  import("./AccountRecoveryScreen").then(({ AccountRecoveryScreen }) => ({ default: AccountRecoveryScreen }))
);

const SubscriptionSuspendedScreen = lazy(() =>
  import("./SubscriptionSuspendedScreen").then(({ SubscriptionSuspendedScreen }) => ({
    default: SubscriptionSuspendedScreen,
  }))
);

type SubStatus = "active" | "trialing" | "overdue" | "canceled" | "expired" | null;

// Cache somente em memória — sessionStorage era manipulável via DevTools.
const subStatusCache = new Map<string, SubStatus>();
const REVALIDAR_STATUS_MS = 5 * 60 * 1000;

export function PrivateRoute() {
  const { isAuthenticated, profile, loading, mfaChallengeRequired } = useAuth();
  const location = useLocation();

  const mfaBypass = mfaDevBypass();
  const empresaId = profile?.empresa_id;
  const [subscription, setSubscription] = useState<{ empresaId: string; status: SubStatus } | null>(null);
  const subStatus = empresaId
    ? subscription?.empresaId === empresaId
      ? subscription.status
      : (subStatusCache.get(empresaId) ??
        // Veio junto com o perfil: sem uma consulta extra de assinatura na entrada.
        (profile?.assinatura !== undefined ? (statusDeAcesso(profile.assinatura) as SubStatus) : undefined))
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

  // Rechecagem: o status era lido uma vez por sessão, então quem já estava logado
  // seguia usando o app depois de cancelar ou do convite vencer. Relê ao voltar
  // para a aba e a cada 5 min. Falha transitória mantém o status atual (não
  // trava ninguém por erro de rede); o banco recusa a escrita de qualquer forma.
  const gateAtivo = !!isAuthenticated && !!empresaId && !loading && !(mfaChallengeRequired && !mfaBypass);
  useEffect(() => {
    if (!gateAtivo || !empresaId || subStatus === undefined) return;
    let active = true;
    const revalidar = async () => {
      try {
        const { data, error } = await (supabase
          .from("pilar_subscriptions" as never)
          .select("status, current_period_end")
          .eq("empresa_id", empresaId)
          .maybeSingle() as unknown as Promise<{
          data: { status: SubStatus; current_period_end: string | null } | null;
          error: unknown;
        }>);
        if (error || !active) return;
        const status = statusDeAcesso(data) as SubStatus;
        if (subStatusCache.get(empresaId) === status) return;
        subStatusCache.set(empresaId, status);
        setSubscription({ empresaId, status });
      } catch {
        // mantém o status atual
      }
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void revalidar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    // Escrita recusada pelo banco (assinatura suspensa): relê na hora, sem esperar.
    window.addEventListener(EVENTO_ASSINATURA_SUSPENSA, revalidar);
    const timer = window.setInterval(() => void revalidar(), REVALIDAR_STATUS_MS);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      window.removeEventListener(EVENTO_ASSINATURA_SUSPENSA, revalidar);
      window.clearInterval(timer);
    };
  }, [gateAtivo, empresaId, subStatus]);

  // Dados da primeira tela chegam por trás do véu, em paralelo com a checagem de assinatura.
  const entradaPronta = useEntradaPronta(empresaId ?? undefined, location.pathname);

  // Véu de entrada (SPEC 106): o nome da empresa entra assim que o perfil chega.
  const veilLabel = profile?.empresas?.nome ? `Abrindo ${profile.empresas.nome}` : undefined;

  if (loading) {
    return <EntryVeil label={veilLabel} />;
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
      <Suspense fallback={<EntryVeil />}>
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

  // SPEC 151: o login começou num pedido de conexão do ChatGPT/Claude. Senha, Google e MFA
  // terminam aqui; volta para a tela de autorização em vez de abrir o Início.
  const pedidoDeConexao = autorizacaoPendente();
  if (pedidoDeConexao) {
    return <Navigate to={rotaDeAutorizacao(pedidoDeConexao)} replace />;
  }

  if (empresaId && (subStatus === undefined || !entradaPronta)) {
    return <EntryVeil label={veilLabel} />;
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
    return (
      <Suspense fallback={<EntryVeil />}>
        <SubscriptionSuspendedScreen isAdmin={isAdmin} />
      </Suspense>
    );
  }

  const justLoggedIn = sessionStorage.getItem("pilar_post_login") === "1";
  if (isUltraAdmin(profile?.role) && justLoggedIn && location.pathname === "/inicio") {
    sessionStorage.removeItem("pilar_post_login");
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
