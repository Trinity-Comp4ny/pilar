import type { ReactNode } from "react";

/** Par rótulo/valor curto, pra blocos de fatos (detalhe da empresa). */
export function Fato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}
