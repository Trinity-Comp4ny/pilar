import type { ReactNode } from "react";

interface BrowserFrameProps {
  url: string;
  children: ReactNode;
  className?: string;
}

/** Frame de "navegador" (dots + barra de URL) que envolve screenshots do produto. */
export function BrowserFrame({ url, children, className }: BrowserFrameProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_-12px_rgba(0,0,0,0.08)] ${className ?? ""}`}
    >
      <div className="px-6 py-3 flex items-center gap-2 border-b border-slate-100">
        <span className="w-2 h-2 rounded-full bg-slate-200" />
        <span className="w-2 h-2 rounded-full bg-slate-200" />
        <span className="w-2 h-2 rounded-full bg-slate-200" />
        <span className="ml-3 text-[11px] text-slate-400 font-light tabular-nums tracking-tight">{url}</span>
      </div>
      {children}
    </div>
  );
}
