import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Palavra que gira dentro do H1, no padrão medido na hero do notion.com:
 * pílula de fundo pastel com um ponto sólido do mesmo matiz, e o texto
 * seguindo escuro. A troca é morph de largura com corte (300ms), medindo a
 * palavra nova num span espelho; a cor troca instantaneamente.
 *
 * Substitui o antigo marcador verde atrás da palavra (RotatingWord).
 */

export interface PillWord {
  palavra: string;
  /** Classe de fundo da pílula (token de módulo). */
  fill: string;
  /** Classe de fundo do ponto (versão forte do mesmo token). */
  dot: string;
}

interface RotatingPillProps {
  words: PillWord[];
  intervalMs?: number;
}

export function RotatingPill({ words, intervalMs = 2500 }: RotatingPillProps) {
  const [index, setIndex] = useState(0);
  const [largura, setLargura] = useState<number | undefined>(undefined);
  const espelhoRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  const atual = words[index];

  // Mede antes da pintura, pra largura inicial não "pular" no primeiro frame.
  useLayoutEffect(() => {
    if (espelhoRef.current) setLargura(espelhoRef.current.getBoundingClientRect().width);
  }, [atual.palavra]);

  useEffect(() => {
    if (reducedMotion || words.length < 2) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [reducedMotion, words.length, intervalMs]);

  return (
    <span
      className={`inline-flex items-center gap-[0.15em] rounded-full px-[0.3em] py-[0.07em] text-[0.78em] leading-none align-baseline translate-y-[0.06em] ${atual.fill}`}
    >
      <span className={`w-[0.62em] h-[0.62em] rounded-[0.19em] shrink-0 ${atual.dot}`} aria-hidden="true" />
      <span
        // leading-normal (não herda o leading-none do pai): o corte de
        // largura usa overflow-hidden, e com line-height 1 a caixa de linha
        // fica menor que o descendente de letras como "g", cortando-o.
        className="overflow-hidden whitespace-nowrap inline-block leading-normal"
        style={{
          width: largura ? `${Math.ceil(largura)}px` : undefined,
          // Curva medida na hero do Notion. Em style porque a classe
          // arbitrária equivalente é ambígua pro Tailwind.
          transition: reducedMotion ? undefined : "width 300ms cubic-bezier(.86,0,.07,1)",
        }}
      >
        {atual.palavra}
      </span>
      {/* Espelho fora de fluxo: mede a palavra na tipografia real. */}
      <span
        ref={espelhoRef}
        className="absolute invisible whitespace-nowrap pointer-events-none -left-[9999px]"
        aria-hidden="true"
      >
        {atual.palavra}
      </span>
    </span>
  );
}
