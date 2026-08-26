import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Botão principal da landing: pílula inteira no verde da marca, com tinta
 * escura por cima (a regra da marca: o verde é fundo, nunca texto).
 *
 * A seta é reta e aponta para a direita; no hover ela gira para cima, no gesto
 * de "abrir". Antes o botão era partido, com só a ponta verde e uma seta
 * diagonal duplicada, o que lia como defeito de renderização.
 */

interface SplitButtonProps {
  children: ReactNode;
  href?: string;
  to?: string;
  onClick?: () => void;
  /** `sm` no header, `md` na hero e no CTA final. */
  tamanho?: "sm" | "md";
  /** Variante de contorno, para o secundário ao lado do primário. */
  fantasma?: boolean;
  className?: string;
}

const MEDIDAS = {
  sm: { corpo: "h-9 pl-4 pr-3 gap-2 text-[13.5px]", seta: "w-3.5 h-3.5" },
  md: { corpo: "h-12 pl-6 pr-5 gap-2.5 text-[15px]", seta: "w-4 h-4" },
};

/** Seta reta. Aponta à direita e sobe no hover. */
function Seta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SplitButton({
  children,
  href,
  to,
  onClick,
  tamanho = "md",
  fantasma = false,
  className,
}: SplitButtonProps) {
  const m = MEDIDAS[tamanho];

  const classe = [
    "group inline-flex items-center justify-center rounded-full font-medium transition-colors",
    m.corpo,
    fantasma ? "border border-paper-border bg-frame text-ink hover:bg-paper-alt" : "bg-brand text-ink hover:bg-brand/85",
    className ?? "",
  ].join(" ");

  const conteudo = (
    <>
      {children}
      <Seta className={`${m.seta} transition-transform duration-300 group-hover:-rotate-90`} />
    </>
  );

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
