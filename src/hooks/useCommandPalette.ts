import { useState, useCallback, useEffect } from "react";
import { EVENTO_ABRIR_PALETA } from "@/lib/paletaComandosEvento";

/**
 * Hook que controla o estado de abertura da Command Palette
 * e registra o atalho global Cmd+K / Ctrl+K.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    const abrir = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(EVENTO_ABRIR_PALETA, abrir);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(EVENTO_ABRIR_PALETA, abrir);
    };
  }, [toggle]);

  return { open, setOpen, toggle, close };
}
