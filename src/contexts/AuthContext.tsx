import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { monitoring } from "@/lib/monitoring";
import { syncConsentForUser } from "@/lib/cookieConsentSync";
import { STORAGE_KEYS } from "@/constants";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Empresa = Database["public"]["Tables"]["empresas"]["Row"];

export type ProfileWithEmpresa = Profile & {
  empresas: Empresa | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileWithEmpresa | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mfaCurrentLevel, setMfaCurrentLevel] = useState<MfaLevel>("aal1");
  const [mfaNextLevel, setMfaNextLevel] = useState<MfaLevel>("aal1");
  const [hasVerifiedMfaFactor, setHasVerifiedMfaFactor] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*, empresas(*)").eq("id", userId).single();
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
    const p = data as ProfileWithEmpresa;
    setProfile(p);
    setProfileError(false);
    monitoring.setUser({
      id: p.id,
      email: p.email ?? undefined,
      empresa_id: p.empresa_id ?? undefined,
      role: p.role ?? undefined,
    });
  }, []);

  const refreshMfaLevel = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setMfaCurrentLevel((data?.currentLevel as MfaLevel) ?? "aal1");
    setMfaNextLevel((data?.nextLevel as MfaLevel) ?? "aal1");

    const { data: factorsData } = await supabase.auth.mfa.listFactors();
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
    setUser(null);
    setProfile(null);
    setProfileError(false);
    setMfaCurrentLevel("aal1");
    setMfaNextLevel("aal1");
    setHasVerifiedMfaFactor(false);
    monitoring.setUser(null);
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session) {
          setUser(null);
          setProfile(null);
          setLoginHintCookie(false);
          return;
        }

        setUser(session.user);
        setLoginHintCookie(true);
        await fetchProfile(session.user.id);
        // refreshMfaLevel é seguro aqui: initializePromise já resolveu
        await refreshMfaLevel();
        // Preferência de cookie da conta vence o cookie do navegador (ADR 0032).
        // Não bloqueia o boot: falhar aqui só mantém o fail-closed do analytics.
        void syncConsentForUser(session.user.id);
      } catch {
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session) {
        setUser(null);
        setProfile(null);
        setMfaCurrentLevel("aal1");
        setMfaNextLevel("aal1");
        setHasVerifiedMfaFactor(false);
        setLoading(false);
        setLoginHintCookie(false);
        return;
      }

      setUser(session.user);
      setLoginHintCookie(true);
      // _notifyAllSubscribers awaita este callback de dentro do lock de
      // initializePromise. Qualquer supabase.from() ou supabase.auth.* aqui
      // chama getSession() → tenta o mesmo lock → deadlock infinito.
      // setTimeout(0) escapa para a macrotask queue, após o lock ser liberado.
      setTimeout(() => {
        if (!mounted) return;
        void syncConsentForUser(session.user.id);
        fetchProfile(session.user.id)
          .then(() => refreshMfaLevel())
          .catch(() => {
            /* silencia erros de rede */
          })
          .finally(() => {
            if (mounted) setLoading(false);
          });
      }, 0);
    });

    return () => {
      mounted = false;
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
