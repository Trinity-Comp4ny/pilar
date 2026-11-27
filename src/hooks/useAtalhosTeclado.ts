import { useEffect, useState } from "react";
import { isSingleKeyShortcutBlocked } from "@/lib/teclado";

/** Evento global que abre o painel de atalhos (ex.: item "Atalhos de teclado" da paleta ⌘K). */
export const ABRIR_ATALHOS_EVENT = "atalhos:abrir";

export function abrirAtalhosTeclado(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_ATALHOS_EVENT));
}

/**
 * Estado do painel "Atalhos de teclado" e o atalho "?" (Shift+/) que o abre.
 * Leve de propósito: o dialog mora em outro arquivo e só baixa quando abre.
 */
export function useAtalhosTeclado() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "?" || isSingleKeyShortcutBlocked(e)) return;
      e.preventDefault();
      setOpen(true);
    };
    const onAbrir = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(ABRIR_ATALHOS_EVENT, onAbrir);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(ABRIR_ATALHOS_EVENT, onAbrir);
    };
  }, []);

  return { open, setOpen };
}
