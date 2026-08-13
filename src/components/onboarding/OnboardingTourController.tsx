import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { startStepTour, type TourInstance } from "@/lib/onboarding/tour";

/**
 * Dispara o coach mark da página quando o usuário chega numa rota cujo passo de
 * onboarding ainda está pendente e cujo tour ele ainda não viu. Montado uma vez no
 * Layout, acompanha a rota. Só para admin/owner (v1). Nada visual próprio.
 */
export function OnboardingTourController() {
  const { pathname } = useLocation();
  const { isAdmin } = usePermissions();
  const { steps, loading } = useOnboardingProgress();
  const { state, markTourSeen } = useOnboardingState();
  const activeRef = useRef<TourInstance | null>(null);

  const candidate = useMemo(() => {
    if (!isAdmin || loading || state.dismissed) return null;
    return (
      steps.find(
        (s) => s.rota === pathname && !s.done && !state.tours_seen.includes(s.key),
      ) ?? null
    );
  }, [isAdmin, loading, state.dismissed, state.tours_seen, steps, pathname]);

  const candidateKey = candidate?.key ?? null;

  useEffect(() => {
    if (!candidate) return;

    // Espera a tela montar antes de mirar o elemento.
    const timer = setTimeout(() => {
      activeRef.current = startStepTour(candidate, () => {
        void markTourSeen(candidate.key);
      });
    }, 700);

    return () => {
      clearTimeout(timer);
      activeRef.current?.destroy();
      activeRef.current = null;
    };
    // candidateKey/pathname bastam: candidate é derivado deles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey, pathname]);

  return null;
}
