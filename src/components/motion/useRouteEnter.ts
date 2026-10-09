import { useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router-dom";

const ENTER: Keyframe[] = [
  { opacity: 0, transform: "translateY(8px)" },
  { opacity: 1, transform: "none" },
];

/** "/financeiro/fluxo" e "/financeiro/mensal" são o mesmo módulo. */
export const routeSection = (pathname: string): string => pathname.split("/")[1] ?? "";

/**
 * Navegação comum (T05, ADR 0049): ao trocar de módulo, o conteúdo entra com fade e
 * 8px de subida em 180ms. Trocar de aba dentro do mesmo módulo não anima, e nada
 * remonta: a animação roda no elemento que já está na tela.
 */
export function useRouteEnter(ref: RefObject<HTMLElement>) {
  const section = routeSection(useLocation().pathname);
  const previous = useRef(section);

  useLayoutEffect(() => {
    if (previous.current === section) return;
    previous.current = section;
    const el = ref.current;
    if (!el?.animate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(ENTER, { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  }, [section, ref]);
}
