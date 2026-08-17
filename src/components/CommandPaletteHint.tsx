/**
 * Indicador sutil do atalho ⌘K. Fica em arquivo próprio (sem importar o cmdk)
 * para o Layout renderizá-lo sem puxar o CommandPalette para o bundle de entrada.
 */
export function CommandPaletteHint() {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  const combo = isMac ? "⌘K" : "Ctrl+K";
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 hidden select-none items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur md:flex">
      <kbd className="font-mono">{combo}</kbd>
      <span>para comandos</span>
    </div>
  );
}
