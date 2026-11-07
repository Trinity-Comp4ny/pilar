/**
 * Ambiente de teste da landing (jsdom).
 *
 * O jsdom não tem `matchMedia`, `IntersectionObserver`, `ResizeObserver` nem
 * `scrollTo`, e a landing usa os quatro (framer-motion, cena da hero, scroll
 * suave). Os stubs ficam aqui, e não no setup global do Vitest, porque só a
 * landing precisa deles: cada arquivo de teste chama `prepararAmbiente()`.
 */
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { domAnimation, LazyMotion } from "framer-motion";
import { vi } from "vitest";

export interface OpcoesAmbiente {
  /** Liga `prefers-reduced-motion: reduce`. O framer-motion lê isso uma vez por módulo. */
  movimentoReduzido?: boolean;
}

export function prepararAmbiente({ movimentoReduzido = false }: OpcoesAmbiente = {}) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: movimentoReduzido && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  class ObservadorParado {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", ObservadorParado);
  vi.stubGlobal("ResizeObserver", ObservadorParado);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
}

/** Apaga todos os cookies visíveis do documento (consentimento, hint de login). */
export function limparCookies() {
  for (const entrada of document.cookie.split("; ")) {
    const nome = entrada.split("=")[0];
    if (nome) document.cookie = `${nome}=; path=/; max-age=0`;
  }
}

/** Renderiza dentro do roteador e do LazyMotion, como o `main.tsx` + `App.tsx` fazem. */
export function renderNaRota(ui: ReactNode, rota = "/") {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <LazyMotion features={domAnimation}>{ui}</LazyMotion>
    </MemoryRouter>
  );
}
