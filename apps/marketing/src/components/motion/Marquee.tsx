import { Children, type ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";

interface MarqueeProps {
  children: ReactNode;
  /** Segundos para percorrer uma cópia inteira. Maior = mais lento. */
  duration?: number;
  reverse?: boolean;
  className?: string;
}

/**
 * Faixa que desliza em loop, com as bordas esmaecidas.
 *
 * O conteúdo é duplicado e a faixa anda exatamente -50%: no instante em que a
 * primeira cópia sai, a segunda está no mesmo pixel de onde a primeira começou,
 * então a emenda é invisível. Padrão clássico de marquee, sem CSS extra.
 */
export function Marquee({ children, duration = 32, reverse = false, className }: MarqueeProps) {
  const reducedMotion = useReducedMotion();
  const itens = Children.toArray(children);

  const conteudo = (chave: string) => (
    <div key={chave} className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={chave === "clone"}>
      {itens}
    </div>
  );

  if (reducedMotion) {
    return <div className={`flex justify-center gap-12 flex-wrap ${className ?? ""}`}>{itens}</div>;
  }

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
      }}
    >
      <m.div
        className="flex w-max"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        {conteudo("original")}
        {conteudo("clone")}
      </m.div>
    </div>
  );
}
