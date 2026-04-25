import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { monitoring } from "@/lib/monitoring";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Empresa = Database["public"]["Tables"]["empresas"]["Row"];

export type ProfileWithEmpresa = Profile & {
  empresas: Empresa | null;
};

export type MfaLevel = "aal1" | "aal2";

interface AuthContextValue {
  user: User | null;
  profile: ProfileWithEmpresa | null;
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileWithEmpresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaCurrentLevel, setMfaCurrentLevel] = useState<MfaLevel>("aal1");
  const [mfaNextLevel, setMfaNextLevel] = useState<MfaLevel>("aal1");
  const [hasVerifiedMfaFactor, setHasVerifiedMfaFactor] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*, empresas(*)").eq("id", userId).single();
    if (error) {
      setProfile(null);
      monitoring.setUser(null);
      return;
    }
    const p = data as ProfileWithEmpresa;
    setProfile(p);
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
    localStorage.removeItem("pilar-auth");
    localStorage.removeItem("pilar-user-name");
    setUser(null);
    setProfile(null);
    setMfaCurrentLevel("aal1");
    setMfaNextLevel("aal1");
    setHasVerifiedMfaFactor(false);
    monitoring.setUser(null);
  }, []);

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
          return;
        }

        setUser(session.user);
        await fetchProfile(session.user.id);
        // refreshMfaLevel é seguro aqui: initializePromise já resolveu
        await refreshMfaLevel();
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
        return;
      }

      setUser(session.user);
      // _notifyAllSubscribers awaita este callback de dentro do lock de
      // initializePromise. Qualquer supabase.from() ou supabase.auth.* aqui
      // chama getSession() → tenta o mesmo lock → deadlock infinito.
      // setTimeout(0) escapa para a macrotask queue, após o lock ser liberado.
      setTimeout(() => {
        if (!mounted) return;
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
