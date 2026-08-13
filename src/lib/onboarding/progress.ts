import type { Feature } from "@/lib/permissions";
import {
  PILAR_LABEL,
  PILAR_ORDER,
  type OnboardingStep,
  type OnboardingPilar,
} from "@/lib/onboarding/steps";

export interface OnboardingStepView extends OnboardingStep {
  done: boolean;
}

export interface OnboardingSectionView {
  pilar: OnboardingPilar;
  label: string;
  steps: OnboardingStepView[];
  done: number;
  total: number;
}

export interface OnboardingDerived {
  steps: OnboardingStepView[];
  sections: OnboardingSectionView[];
  totalSteps: number;
  doneSteps: number;
  percent: number;
  requiredTotal: number;
  requiredDone: number;
  allDone: boolean;
  allRequiredDone: boolean;
  nextStep: OnboardingStepView | null;
}

/** Filtra os passos pelo que o usuário/empresa pode ver (feature + admin). */
export function filterVisibleSteps(
  steps: OnboardingStep[],
  can: (feature: Feature) => boolean,
  isAdmin: boolean,
): OnboardingStep[] {
  return steps.filter((s) => can(s.feature) && (!s.adminOnly || isAdmin));
}

/** Deriva progresso e seções a partir das contagens (source -> count). */
export function deriveProgress(
  visibleSteps: OnboardingStep[],
  counts: Record<string, number>,
): OnboardingDerived {
  const steps: OnboardingStepView[] = visibleSteps.map((s) => ({
    ...s,
    done: (counts[s.count.source] ?? 0) > 0,
  }));

  const sections: OnboardingSectionView[] = PILAR_ORDER.map((pilar) => {
    const sectionSteps = steps.filter((s) => s.pilar === pilar);
    return {
      pilar,
      label: PILAR_LABEL[pilar],
      steps: sectionSteps,
      done: sectionSteps.filter((s) => s.done).length,
      total: sectionSteps.length,
    };
  }).filter((sec) => sec.total > 0);

  const totalSteps = steps.length;
  const doneSteps = steps.filter((s) => s.done).length;
  const required = steps.filter((s) => !s.opcional);
  const requiredDone = required.filter((s) => s.done).length;
  const nextStep =
    steps.find((s) => !s.done && !s.opcional) ?? steps.find((s) => !s.done) ?? null;

  return {
    steps,
    sections,
    totalSteps,
    doneSteps,
    percent: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0,
    requiredTotal: required.length,
    requiredDone,
    allDone: totalSteps > 0 && doneSteps === totalSteps,
    allRequiredDone: required.length > 0 && requiredDone === required.length,
    nextStep,
  };
}
