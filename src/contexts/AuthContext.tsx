import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Empresa = Database["public"]["Tables"]["empresas"]["Row"];

export type ProfileWithEmpresa = Profile & {
  empresas: Empresa | null;
};

interface AuthContextValue {
  user: User | null;
  profile: ProfileWithEmpresa | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*, empresas(*)").eq("id", userId).single();

    if (error) {
      setProfile(null);
      return;
    }

    setProfile(data as ProfileWithEmpresa);
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
        setLoading(false);
        return;
      }

      // NÃO usar async/await aqui — o Supabase aguarda os handlers antes de
      // resolver signInWithPassword, causando travamento no botão de login.
      setUser(session.user);
      fetchProfile(session.user.id).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthenticated, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
