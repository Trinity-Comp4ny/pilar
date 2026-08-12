import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";

const STALE_TIME = 5 * 60 * 1000;

/**
 * Hook para feature flags caseiros (tabela public.feature_flags + RPC
 * is_feature_flag_enabled). Em paralelo, consulta PostHog feature flags se
 * VITE_POSTHOG_KEY estiver presente — retornamos true se *qualquer* fonte
 * habilitar a flag (failsafe para rollouts híbridos).
 *
 * Cache de 5min via React Query, chaveado por user.id + key para evitar
 * vazamento entre sessões.
 */
export function useFeatureFlag(key: string): { enabled: boolean; isLoading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["feature-flag", user?.id ?? "anon", key],
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 2,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_feature_flag_enabled", { p_key: key });
      if (error) return false;
      const dbEnabled = data === true;
      if (dbEnabled) return true;

      const phEnabled = analytics.isFeatureEnabled(key);
      return phEnabled === true;
    },
  });

  return { enabled: data ?? false, isLoading };
}
