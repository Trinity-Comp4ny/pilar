import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  parseOnboardingState,
  persistOnboardingState,
  type OnboardingState,
} from "@/lib/onboarding/state";

/**
 * Lê o meta-estado do onboarding do profile já carregado no AuthContext e expõe
 * mutações que persistem via RPC e recarregam o profile. Fonte da verdade do
 * "dispensou / concluiu / tours vistos"; o progresso vem do useOnboardingProgress.
 */
export function useOnboardingState() {
  const { profile, refreshProfile } = useAuth();

  const raw = (profile as { onboarding_state?: unknown } | null)?.onboarding_state;
  const state = useMemo(() => parseOnboardingState(raw), [raw]);

  const mutate = useCallback(
    async (patch: Partial<OnboardingState>) => {
      await persistOnboardingState(patch);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const dismiss = useCallback((value = true) => mutate({ dismissed: value }), [mutate]);

  const reset = useCallback(
    () => mutate({ dismissed: false, completed_at: null, tours_seen: [] }),
    [mutate],
  );

  const markTourSeen = useCallback(
    (key: string) => {
      if (state.tours_seen.includes(key)) return Promise.resolve();
      return mutate({ tours_seen: [...state.tours_seen, key] });
    },
    [mutate, state.tours_seen],
  );

  const setCompleted = useCallback(() => {
    if (state.completed_at) return Promise.resolve();
    return mutate({ completed_at: new Date().toISOString() });
  }, [mutate, state.completed_at]);

  return { state, dismiss, reset, markTourSeen, setCompleted };
}
