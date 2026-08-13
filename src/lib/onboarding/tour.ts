import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/styles/onboarding-tour.css";
import type { OnboardingStep } from "@/lib/onboarding/steps";

export type TourInstance = ReturnType<typeof driver>;

/**
 * Coach mark de uma etapa: destaca o elemento `[data-tour=...]` da página e mostra
 * um balão. Só dispara se o alvo já está montado; senão devolve null (o controller
 * tenta de novo quando a tela terminar de montar). Tematizado em onboarding-tour.css.
 */
export function startStepTour(step: OnboardingStep, onDone: () => void): TourInstance | null {
  if (typeof document === "undefined") return null;

  const selector = `[data-tour="${step.tour.selector}"]`;
  if (!document.querySelector(selector)) return null;

  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    onDone();
  };

  const tour = driver({
    showProgress: false,
    allowClose: true,
    overlayOpacity: 0.5,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: "onb-popover",
    showButtons: ["next", "close"],
    doneBtnText: "Entendi",
    onDestroyed: finishOnce,
    steps: [
      {
        element: selector,
        popover: {
          title: step.tour.titulo,
          description: step.tour.texto,
          side: "bottom",
          align: "start",
        },
      },
    ],
  });

  tour.drive();
  return tour;
}
