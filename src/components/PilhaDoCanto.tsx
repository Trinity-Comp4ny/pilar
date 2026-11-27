import type { ReactNode } from "react";

/**
 * Canto inferior direito do app: um só contêiner fixo para tudo que flutua ali (avisos, pesquisa e
 * checklist de início). Cada item ocupa o próprio espaço na coluna, então nunca se sobrepõem.
 * O contêiner não captura toque; só os cartões (pointer-events-auto). No celular fica acima da
 * barra de navegação. Ordem de cima para baixo: avisos, NPS, checklist.
 */
export function PilhaDoCanto({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end justify-end gap-3 md:bottom-4">
      {children}
    </div>
  );
}
