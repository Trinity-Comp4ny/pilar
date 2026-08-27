import type { ReactNode } from "react";

interface BrowserFrameProps {
  url: string;
  children: ReactNode;
  className?: string;
}

/**
 * Frame de "navegador" (dots + barra de URL) que envolve as telas de produto.
 * Todo em token do design system: a versão anterior usava slate-* cru, que
 * destoava do resto da landing.
 */
export function BrowserFrame({ url, children, className }: BrowserFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-[20px] border border-paper-border/80 bg-frame shadow-[0_28px_56px_-24px_rgba(0,0,0,0.22)] ${className ?? ""}`}
    >
      <div className="flex items-center gap-1.5 border-b border-paper-border/60 bg-paper-alt/60 px-5 py-2.5">
        <span className="h-2 w-2 rounded-full bg-paper-border" />
        <span className="h-2 w-2 rounded-full bg-paper-border" />
        <span className="h-2 w-2 rounded-full bg-paper-border" />
        <span className="ml-3 max-w-[380px] flex-1 truncate rounded-full border border-paper-border/60 bg-frame px-3.5 py-1 text-[11px] tabular-nums text-ink-muted">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}
