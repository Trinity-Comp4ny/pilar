import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { monitoring } from "@/lib/monitoring";
import { analytics } from "@/lib/analytics";
import { syncConsentForUser } from "@/lib/cookieConsentSync";
import { STORAGE_KEYS } from "@/constants";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Empresa = Database["public"]["Tables"]["empresas"]["Row"];

/** Linha de pilar_subscriptions que o PrivateRoute usa para decidir o acesso. */
type AssinaturaInicial = { status: string; current_period_end: string | null };

export type ProfileWithEmpresa = Profile & {
  empresas: Empresa | null;
  /**
   * Vem na mesma consulta do perfil (uma ida ao banco a menos na entrada).
   * undefined = não veio junto (o PrivateRoute busca); null = empresa sem assinatura.
   */
  assinatura?: AssinaturaInicial | null;
};

export type MfaLevel = "aal1" | "aal2";

interface AuthContextValue {
  user: User | null;
  profile: ProfileWithEmpresa | null;
  profileError: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  mfaCurrentLevel: MfaLevel;
  mfaNextLevel: MfaLevel;
  mfaChallengeRequired: boolean;
  hasVerifiedMfaFactor: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshMfaLevel: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Cookie não sensível (sem token) compartilhado com pilarsoft.com.br pra landing trocar o CTA; quem autentica de verdade continua sendo o redirect em Login/Signup.
const LOGIN_HINT_COOKIE = "pilar_logged_hint";

function setLoginHintCookie(loggedIn: boolean) {
  const { hostname } = window.location;
  const domainAttr = hostname.endsWith("pilarsoft.com.br") ? "; domain=.pilarsoft.com.br" : "";
  document.cookie = loggedIn
    ? `${LOGIN_HINT_COOKIE}=1; path=/; max-age=2592000; samesite=lax${domainAttr}`
    : `${LOGIN_HINT_COOKIE}=; path=/; max-age=0${domainAttr}`;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/** Uma vez por sessão do navegador (recarregar a página não conta como novo login). */
function registrarLogin(userId: string, role: string | undefined) {
  const chave = "pilar_login_registrado";
  try {
    if (sessionStorage.getItem(chave) === userId) return;
    sessionStorage.setItem(chave, userId);
  } catch {
    // sem sessionStorage: registra mesmo assim, melhor contar a mais que perder o login
  }
  analytics.track("login_realizado", { role });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileWithEmpresa | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mfaCurrentLevel, setMfaCurrentLevel] = useState<MfaLevel>("aal1");
  const [mfaNextLevel, setMfaNextLevel] = useState<MfaLevel>("aal1");
  const [hasVerifiedMfaFactor, setHasVerifiedMfaFactor] = useState(false);
  const activeUserId = useRef<string | null>(null);
  const profileRequest = useRef(0);

  const fetchProfile = useCallback(async (userId: string) => {
    const request = ++profileRequest.current;
    let data;
    let error;
    try {
      ({ data, error } = await supabase
        .from("profiles")
        .select("*, empresas(*, pilar_subscriptions(status, current_period_end))")
        .eq("id", userId)
        .single());
    } catch (err) {
      if (activeUserId.current === userId && request === profileRequest.current) {
        setProfileError(true);
        monitoring.captureException(err, { context: "fetchProfile", userId });
      }
      return;
    }
    if (activeUserId.current !== userId || request !== profileRequest.current) return;
    if (error) {
      // "No rows" (PGRST116) é esperado (usuário sem profile ainda, ex.: durante
      // o onboarding). Qualquer outro erro é de infra: não engolir e não apagar
      // um profile já carregado por causa de uma falha transitória de rede, mas
      // marcar profileError para a UI parar de mostrar loading infinito.
      if (error.code === "PGRST116") {
        setProfile(null);
        setProfileError(false);
        monitoring.setUser(null);
      } else {
        setProfileError(true);
        monitoring.captureException(error, { context: "fetchProfile", userId });
      }
      return;
    }
    const bruto = data as unknown as ProfileWithEmpresa & {
      empresas: { pilar_subscriptions?: AssinaturaInicial | AssinaturaInicial[] | null } | null;
    };
    const assinaturas = bruto.empresas?.pilar_subscriptions;
    const p: ProfileWithEmpresa = {
      ...bruto,
      assinatura: bruto.empresas ? ([assinaturas ?? null].flat()[0] ?? null) : undefined,
    };
    setProfile(p);
    setProfileError(false);
    // Só id, empresa e papel: telemetria não recebe contato da pessoa (docs/ROPA.md,
    // itens 11 e 14). Para achar o usuário de um erro, o id leva ao perfil no admin.
    monitoring.setUser({
      id: p.id,
      empresa_id: p.empresa_id ?? undefined,
      role: p.role ?? undefined,
    });
    analytics.identify(p.id, {
      empresa_id: p.empresa_id ?? undefined,
      role: p.role ?? undefined,
    });
    registrarLogin(p.id, p.role ?? undefined);
  }, []);

  const refreshMfaLevel = useCallback(async (sessionUser?: User) => {
    const userId = activeUserId.current;
    // Quem não tem nenhum fator cadastrado (a maioria: MFA não é padrão) não precisa das duas
    // idas ao Auth, que travavam a entrada. A sessão já traz os fatores do usuário.
    if (sessionUser?.factors && sessionUser.factors.length === 0) {
      setMfaCurrentLevel("aal1");
      setMfaNextLevel("aal1");
      setHasVerifiedMfaFactor(false);
      return;
    }
    // Em paralelo: eram duas idas ao Auth em sequência na entrada.
    const [{ data }, { data: factorsData }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    if (activeUserId.current !== userId) return;
    setMfaCurrentLevel((data?.currentLevel as MfaLevel) ?? "aal1");
    setMfaNextLevel((data?.nextLevel as MfaLevel) ?? "aal1");
    setHasVerifiedMfaFactor(!!factorsData?.totp?.some((f) => f.status === "verified"));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Limpa o cache do react-query para não vazar dados de uma role/sessão
    // para a próxima que logar na mesma aba (bleed observado no QA).
    queryClient.clear();
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.USER_NAME);
    localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    // Sem isto, o próximo login (mesmo de outro usuário) reabre a conversa de agentes de quem saiu.
    localStorage.removeItem(STORAGE_KEYS.CHAT_SNAPSHOT);
    activeUserId.current = null;
    profileRequest.current++;
    setUser(null);
    setProfile(null);
    setProfileError(false);
    setMfaCurrentLevel("aal1");
    setMfaNextLevel("aal1");
    setHasVerifiedMfaFactor(false);
    monitoring.setUser(null);
    analytics.reset();
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;
    let authEventReceived = false;
    let generation = 0;

    const prepareSession = (nextUser: User | null) => {
      const currentGeneration = ++generation;
      if (activeUserId.current !== (nextUser?.id ?? null)) {
        activeUserId.current = nextUser?.id ?? null;
        profileRequest.current++;
        setProfile(null);
        setProfileError(false);
        setMfaCurrentLevel("aal1");
        setMfaNextLevel("aal1");
        setHasVerifiedMfaFactor(false);
        setLoading(!!nextUser);
      }
      setUser(nextUser);
      setLoginHintCookie(!!nextUser);
      if (!nextUser) setLoading(false);
      return currentGeneration;
    };

    const hydrate = async (nextUser: User, currentGeneration: number) => {
      if (!mounted || generation !== currentGeneration) return;
      try {
        // Perfil e nível de MFA não dependem um do outro: saem juntos.
        await Promise.all([fetchProfile(nextUser.id), refreshMfaLevel(nextUser)]);
        if (!mounted || generation !== currentGeneration) return;
        void syncConsentForUser(nextUser.id);
      } catch (error) {
        monitoring.captureException(error, { context: "auth-session-load", userId: nextUser.id });
      } finally {
        if (mounted && generation === currentGeneration) setLoading(false);
      }
    };

    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!mounted || authEventReceived) return;
        if (error) throw error;
        const currentGeneration = prepareSession(session?.user ?? null);
        if (session) await hydrate(session.user, currentGeneration);
      } catch (error) {
        if (mounted && !authEventReceived) {
          monitoring.captureException(error, { context: "auth-session-init" });
          prepareSession(null);
        }
      }
    };

    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      authEventReceived = true;
      const currentGeneration = prepareSession(session?.user ?? null);
      if (!session) return;
      // A callback roda dentro do lock do Auth. Adiar evita deadlock ao buscar
      // profile/MFA e mantém loading até a primeira leitura da sessão terminar.
      setTimeout(() => void hydrate(session.user, currentGeneration), 0);
    });

    return () => {
      mounted = false;
      activeUserId.current = null;
      subscription.unsubscribe();
    };
  }, [fetchProfile, refreshMfaLevel]);

  const isAuthenticated = !!user;
  const mfaChallengeRequired = mfaNextLevel === "aal2" && mfaCurrentLevel === "aal1";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileError,
        loading,
        isAuthenticated,
        mfaCurrentLevel,
        mfaNextLevel,
        mfaChallengeRequired,
        hasVerifiedMfaFactor,
        signOut,
        refreshProfile,
        refreshMfaLevel,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
