import { createContext, useContext } from "react";

/**
 * Verdadeiro dentro do `<main id="main-content">` do Layout. Quem renderiza uma página
 * (PageLayout) usa para não abrir um segundo `<main>` aninhado: dois landmarks "main" na
 * mesma tela confundem leitor de tela (Axe: landmark-no-duplicate-main).
 */
const DentroDoMainContext = createContext(false);

export const DentroDoMainProvider = DentroDoMainContext.Provider;

export function useDentroDoMain(): boolean {
  return useContext(DentroDoMainContext);
}
