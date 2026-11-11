// Entrada do prerender (scripts/prerender.mjs): monta o App numa rota dentro do
// documento jsdom atual e espera a página ficar pronta. Roda via Vite em modo SSR
// (ssrLoadModule), com o código-fonte, sem navegador.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renderiza `rota` dentro de `#root` e devolve quando o <main> tem um H1 (as
 * páginas preguiçosas chegam por import dinâmico) e os efeitos que gravam title,
 * description, canonical e JSON-LD já rodaram. Devolve a função que desmonta:
 * quem chama grava o HTML antes, porque desmontar tira o JSON-LD do <head>.
 */
export async function renderizar(rota: string, prazoMs = 10000): Promise<() => Promise<void>> {
  const container = document.getElementById("root");
  if (!container) throw new Error("index.html sem #root");
  const raiz = createRoot(container);

  await act(async () => {
    raiz.render(
      <MemoryRouter initialEntries={[rota]}>
        <App />
      </MemoryRouter>
    );
  });

  const inicio = Date.now();
  while (!container.querySelector("main h1")) {
    if (Date.now() - inicio > prazoMs) throw new Error(`${rota}: a página não montou um H1 em ${prazoMs} ms`);
    await act(async () => {
      await esperar(25);
    });
  }
  // Uma volta a mais para os useEffect do usePageMeta e do useJsonLd.
  await act(async () => {
    await esperar(50);
  });

  return async () => {
    await act(async () => {
      raiz.unmount();
    });
  };
}
