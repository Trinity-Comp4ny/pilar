import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Botão partido: corpo escuro com o rótulo, e um quadrado do verde da marca com
 * a seta. As duas metades encostam e formam uma pílula só, e a seta desliza na
 * diagonal no hover.
 *
 * É o botão principal da landing inteira (header, hero, CTA final).
 */

interface SplitButtonProps {
  children: ReactNode;
  href?: string;
  to?: string;
  onClick?: () => void;
  /** `sm` no header, `md` na hero e no CTA final. */
  tamanho?: "sm" | "md";
  className?: string;
}

const MEDIDAS = {
  sm: { corpo: "h-9 pl-4 pr-3.5 text-[13.5px]", quadrado: "h-9 w-9", seta: "w-3.5 h-3.5" },
  md: { corpo: "h-12 pl-6 pr-5 text-[15px]", quadrado: "h-12 w-12", seta: "w-4 h-4" },
};

/** Seta diagonal para baixo e à direita, o mesmo glifo em todos os tamanhos. */
function SetaDiagonal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.5 4.5h7v7M11.5 4.5 4.5 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SplitButton({ children, href, to, onClick, tamanho = "md", className }: SplitButtonProps) {
  const m = MEDIDAS[tamanho];

  const conteudo = (
    <>
      <span
        className={`flex items-center justify-center rounded-l-full bg-ink text-white font-medium transition-colors group-hover:bg-ink/90 ${m.corpo}`}
      >
        {children}
      </span>
      <span
        className={`relative flex items-center justify-center overflow-hidden rounded-r-full bg-brand text-ink ${m.quadrado}`}
      >
        {/* A seta sai pela diagonal e uma cópia entra atrás, então o movimento
            é contínuo em vez de um respiro no lugar. */}
        <SetaDiagonal
          className={`${m.seta} transition-transform duration-300 group-hover:translate-x-3.5 group-hover:-translate-y-3.5`}
        />
        <SetaDiagonal
          className={`${m.seta} absolute -translate-x-3.5 translate-y-3.5 transition-transform duration-300 group-hover:translate-x-0 group-hover:translate-y-0`}
        />
      </span>
    </>
  );

  const classe = `group inline-flex items-center gap-px ${className ?? ""}`;

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={classe}>
        {conteudo}
      </Link>
    );
  }

  return (
    <a href={href} onClick={onClick} className={classe}>
      {conteudo}
    </a>
  );
}

/** Pílula de aviso da hero, com o brilho do verde no fim. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-paper-border bg-frame px-3.5 py-1.5 text-[13px] text-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {children}
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-modulo-gestao-strong" fill="currentColor" aria-hidden="true">
        <path d="M8 0.5 9.6 6.4 15.5 8 9.6 9.6 8 15.5 6.4 9.6 0.5 8 6.4 6.4Z" />
      </svg>
    </span>
  );
}
