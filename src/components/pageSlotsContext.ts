import { createContext } from "react";

/** Elementos do bloco sticky do `PageLayout` que filhos podem preencher via portal. */
export interface PageSlots {
  tabsEl: HTMLElement | null;
  toolbarEl: HTMLElement | null;
}

export const PageSlotsContext = createContext<PageSlots>({ tabsEl: null, toolbarEl: null });
