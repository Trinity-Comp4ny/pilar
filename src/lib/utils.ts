import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge não conhece os font-sizes fluidos do design system
 * (text-display/h1/h2/h3/h4/lead, definidos em tailwind.config.ts). Sem isto ele
 * os confunde com `text-<cor>` e descarta o tamanho quando há override de cor
 * (ex.: `text-ink`), zerando o tamanho do título. Registramos as utilities no
 * grupo `font-size` para que tamanho e cor coexistam.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "h4", "lead"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated Importe de "@/lib/format" (ADR 0008). Delegate mantido pela migração. */
export { formatCurrency } from "./format";
