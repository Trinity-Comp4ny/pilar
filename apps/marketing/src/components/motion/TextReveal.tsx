import { Fragment, type ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { EASE, VIEWPORT } from "../../lib/motion";

interface TextRevealProps {
  /** Texto puro. Para destacar um trecho, use `highlight`. */
  text: string;
  /** Trecho do texto que recebe tratamento de destaque (precisa bater literalmente). */
  highlight?: string;
  /** Classe aplicada só às palavras do trecho destacado. */
  highlightClassName?: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p";
}

/**
 * Título que entra palavra por palavra, subindo de baixo com desfoque.
 * Padrão de "text reveal" popularizado por MagicUI/React Bits, reescrito aqui
 * sobre o framer-motion que já temos e com as curvas do nosso vocabulário.
 *
 * Cada palavra é um `inline-block` dentro de um wrapper que corta o transbordo,
 * então a palavra sobe de dentro da própria linha em vez de aparecer do nada.
 */
export function TextReveal({
  text,
  highlight,
  highlightClassName = "",
  className,
  delay = 0,
  as = "h2",
}: TextRevealProps) {
  const reducedMotion = useReducedMotion();
  const Tag = m[as];

  const palavras = text.split(" ");
  const destacadas = highlight ? new Set(highlight.split(" ")) : null;
  // Marca a partir de onde o destaque começa, para não pintar uma palavra
  // repetida que apareça antes do trecho.
  const inicioDestaque = highlight ? text.indexOf(highlight) : -1;
  const primeiraDestacada = inicioDestaque >= 0 ? text.slice(0, inicioDestaque).split(" ").length - 1 : -1;

  return (
    <Tag
      className={className}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={VIEWPORT}
      variants={{ visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.045, delayChildren: delay } } }}
    >
      {palavras.map((palavra, i) => {
        const noDestaque = destacadas?.has(palavra) && i >= primeiraDestacada;
        return (
          <Fragment key={`${palavra}-${i}`}>
            <span className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]">
              <m.span
                className={`inline-block ${noDestaque ? highlightClassName : ""}`}
                variants={{
                  hidden: { y: "108%", opacity: 0, filter: "blur(6px)" },
                  visible: { y: "0%", opacity: 1, filter: "blur(0px)" },
                }}
                transition={{ duration: 0.75, ease: EASE.out }}
              >
                {palavra}
              </m.span>
            </span>
            {i < palavras.length - 1 && " "}
          </Fragment>
        );
      })}
    </Tag>
  );
}

/** Versão que aceita JSX arbitrário e revela o bloco inteiro atrás de uma máscara. */
export function MaskReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <m.div
      className={className}
      initial={reducedMotion ? false : { clipPath: "inset(0 0 100% 0)", opacity: 0 }}
      whileInView={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.9, ease: EASE.out, delay: reducedMotion ? 0 : delay }}
    >
      {children}
    </m.div>
  );
}
