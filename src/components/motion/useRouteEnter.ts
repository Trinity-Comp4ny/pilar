import { useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router-dom";

const ENTER: Keyframe[] = [
  { opacity: 0, transform: "translateY(8px)" },
  { opacity: 1, transform: "none" },
];

/** "/financeiro/fluxo" e "/financeiro/mensal" são o mesmo módulo. */
export const routeSection = (pathname: string): string => pathname.split("/")[1] ?? "";

const MOBILE = "(max-width: 767px)";

/**
 * Navegação comum (T05, ADR 0049): ao trocar de módulo, o conteúdo entra com fade e
 * 8px de subida em 180ms. Trocar de aba dentro do mesmo módulo não anima, e nada
 * remonta: a animação roda no elemento que já está na tela.
 *
 * Exceção do celular (SPEC 134): abaixo de md qualquer troca de rota anima (240ms),
 * porque lá a troca de aba é uma troca de tela inteira.
 */
export function useRouteEnter(ref: RefObject<HTMLElement>) {
  const { pathname } = useLocation();
  const section = routeSection(pathname);
  const previous = useRef({ section, pathname });

  useLayoutEffect(() => {
    const anterior = previous.current;
    previous.current = { section, pathname };
    const mobile = window.matchMedia?.(MOBILE).matches === true;
    const mudou = mobile ? anterior.pathname !== pathname : anterior.section !== section;
    if (!mudou) return;
    const el = ref.current;
    if (!el?.animate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(ENTER, { duration: mobile ? 240 : 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  }, [section, pathname, ref]);
}
