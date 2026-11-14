import type { ReactNode } from "react";

/**
 * Cartão de aviso do canto inferior direito: o lugar de todo aviso que não bloqueia a tela
 * (consentimento de análise, atualização dos Termos). Nunca faixa no topo: a decisão do dono é
 * que o topo fica limpo e o aviso fica pequeno, no canto, com ação clara.
 *
 * Só desenha o cartão; quem posiciona é o `AvisosDoCanto`, que empilha vários sem sobrepor.
 */
export function AvisoCanto({
  icone,
  titulo,
  children,
  acoes,
}: {
  icone: ReactNode;
  titulo: string;
  children: ReactNode;
  acoes: ReactNode;
}) {
  return (
    <div
      role="status"
      className="pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 bg-surface-card p-4 text-sm text-ink shadow-elegant"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-ink-soft">{icone}</span>
        <div className="min-w-0 space-y-1">
          <p className="font-medium leading-snug">{titulo}</p>
          <div className="text-xs leading-relaxed text-ink-muted">{children}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">{acoes}</div>
    </div>
  );
}
