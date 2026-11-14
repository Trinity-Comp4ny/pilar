import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PageSlotsContext } from "./pageSlotsContext";

/**
 * Preenche o slot `toolbar` do `PageLayout` a partir de um componente filho (SPEC 124).
 * Serve para toolbar que depende de dado ou estado da aba (ex.: filtros de Lançamentos,
 * Folha), enquanto a página dona só declara o layout. Sem `PageLayout` ao redor, não
 * renderiza nada. Para toolbar que a própria página sabe montar, use a prop `toolbar`.
 */
export function PageToolbar({ children, inlineSemLayout = false }: { children: ReactNode; inlineSemLayout?: boolean }) {
  const { toolbarEl, dentroDoLayout } = useContext(PageSlotsContext);
  if (toolbarEl) return createPortal(children, toolbarEl);
  // Fora de um PageLayout (tela montada sozinha, teste), `inlineSemLayout` mostra os controles
  // no lugar em vez de sumir com eles.
  return inlineSemLayout && !dentroDoLayout ? <>{children}</> : null;
}

/** Igual ao `PageToolbar`, para o slot `tabs` (ex.: seções do detalhe de Projeto). */
export function PageTabs({ children }: { children: ReactNode }) {
  const { tabsEl } = useContext(PageSlotsContext);
  return tabsEl ? createPortal(children, tabsEl) : null;
}
