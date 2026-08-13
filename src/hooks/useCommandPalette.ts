import { useState, useCallback, useEffect } from "react";

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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { open, setOpen, toggle, close };
}

/**
 * Evento global disparado quando o usuário escolhe um item de "Criar"
 * na Command Palette. As páginas alvo podem ouvir e abrir o dialog
 * correspondente.
 *
 * Exemplo:
 *   useEffect(() => {
 *     const onCreate = () => setDialogOpen(true);
 *     window.addEventListener("palette:create-projeto", onCreate);
 *     return () => window.removeEventListener("palette:create-projeto", onCreate);
 *   }, []);
 */
export type PaletteCreateEvent =
  | "palette:create-projeto"
  | "palette:create-lead"
  | "palette:create-cliente"
  | "palette:create-pessoa"
  | "palette:create-receita"
  | "palette:create-despesa";
