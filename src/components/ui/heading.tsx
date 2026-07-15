import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Heading — título com tamanho VISUAL desacoplado da tag SEMÂNTICA.
 * Escolha `as` pela hierarquia do documento (h1..h6) e `size` pela aparência.
 * Ex.: um <h1> de página pode usar size="display"; um subtítulo <h2>, size="h3".
 *
 * Tamanhos fluidos (clamp via tokens em tokens.css): escalam sozinhos de mobile
 * a telas grandes, com line-height acoplada ao token (ver tailwind.config).
 * Sem leading-* aqui (o tailwind-merge o descartaria contra o text-*); heros
 * podem sobrescrever com leading-[...] APÓS o size.
 * Uso: landing e títulos de módulo. NÃO usar em tabelas de dados.
 */
const headingVariants = cva("text-ink text-balance font-heading", {
  variants: {
    size: {
      display: "text-display font-bold tracking-tight",
      h1: "text-h1 font-semibold tracking-tight",
      h2: "text-h2 font-semibold tracking-tight",
      h3: "text-h3 font-semibold",
      h4: "text-h4 font-medium",
    },
  },
  defaultVariants: {
    size: "h2",
  },
});

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  /** Tag renderizada (semântica); independente do tamanho visual. */
  as?: HeadingTag;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, size, as = "h2", ...props }, ref) =>
    React.createElement(as, {
      ref,
      className: cn(headingVariants({ size }), className),
      ...props,
    })
);

Heading.displayName = "Heading";

export { Heading, headingVariants };
