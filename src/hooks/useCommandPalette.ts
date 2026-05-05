import { useEffect, useState, useCallback } from "react";

/**
 * Hook que controla o estado de abertura da Command Palette
 * e registra o atalho global Cmd+K / Ctrl+K.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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
