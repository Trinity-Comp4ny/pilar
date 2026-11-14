import { Search } from "lucide-react";
import { teclaModificadora } from "@/lib/teclado";
import { abrirPaletaComandos } from "@/lib/paletaComandosEvento";

/**
 * Atalho ⌘K no rodapé do trilho da sidebar. Antes era uma etiqueta fixa no canto inferior
 * direito, por cima do conteúdo (Kanban, tabelas, legenda do Gantt) em toda tela; aqui ela
 * ocupa um espaço que já existe e ainda abre a paleta no clique (auditoria de espaço, 2026-11).
 * Fica em arquivo próprio (sem importar o cmdk) para não puxar o CommandPalette para o bundle
 * de entrada: o clique só dispara o evento que o Layout escuta.
 */
export function CommandPaletteHint() {
  const mod = teclaModificadora();
  const combo = mod === "⌘" ? "⌘K" : "Ctrl+K";
  return (
    <button
      type="button"
      onClick={abrirPaletaComandos}
      aria-label={`Buscar e comandos (${combo})`}
      title={`Buscar e comandos (${combo})`}
      className="group flex w-14 flex-col items-center gap-1 rounded-xl py-1 text-black/60 transition-colors hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10"
    >
      <span className="flex h-8 w-10 items-center justify-center rounded-full transition-colors group-hover:bg-brand/30">
        <Search size={18} strokeWidth={1.5} aria-hidden />
      </span>
      <kbd className="font-mono text-3xs leading-none">{combo}</kbd>
    </button>
  );
}
