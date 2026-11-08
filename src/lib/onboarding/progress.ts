import type { Feature } from "@/lib/permissions";
import {
  PILAR_LABEL,
  PILAR_ORDER,
  chaveDaContagem,
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

/** O que se sabe para decidir se cada passo está feito. */
export interface OnboardingFatos {
  /** Contagem por chave (ver chaveDaContagem). */
  counts: Record<string, number>;
  /** Campos preenchidos no perfil de quem vê. */
  perfil?: { avatar_url?: string | null };
}

/** Filtra os passos pelo que o usuário/empresa pode ver (feature + admin). */
export function filterVisibleSteps(
  steps: OnboardingStep[],
  can: (feature: Feature) => boolean,
  isAdmin: boolean
): OnboardingStep[] {
  return steps.filter((s) => (!s.feature || can(s.feature)) && (!s.adminOnly || isAdmin));
}

export function passoFeito(step: OnboardingStep, fatos: OnboardingFatos): boolean {
  const { check } = step;
  if (check.tipo === "sempre") return true;
  if (check.tipo === "perfil") return Boolean(fatos.perfil?.[check.campo]);
  return (fatos.counts[chaveDaContagem(check)] ?? 0) >= (check.minimo ?? 1);
}

/**
 * Deriva progresso e seções. `ordem` define a sequência das seções (e, por
 * consequência, qual é o próximo passo): o pilar escolhido pelo dono vem logo
 * depois de "Sua conta".
 */
export function deriveProgress(
  visibleSteps: OnboardingStep[],
  fatos: OnboardingFatos,
  ordem: OnboardingPilar[] = PILAR_ORDER
): OnboardingDerived {
  const sections: OnboardingSectionView[] = ordem
    .map((pilar) => {
      const sectionSteps = visibleSteps
        .filter((s) => s.pilar === pilar)
        .map((s) => ({ ...s, done: passoFeito(s, fatos) }));
      return {
        pilar,
        label: PILAR_LABEL[pilar],
        steps: sectionSteps,
        done: sectionSteps.filter((s) => s.done).length,
        total: sectionSteps.length,
      };
    })
    .filter((sec) => sec.total > 0);

  const steps = sections.flatMap((sec) => sec.steps);
  const totalSteps = steps.length;
  const doneSteps = steps.filter((s) => s.done).length;
  const required = steps.filter((s) => !s.opcional);
  const requiredDone = required.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done && !s.opcional) ?? steps.find((s) => !s.done) ?? null;

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
