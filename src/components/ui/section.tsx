import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Section — faixa horizontal com ritmo vertical fluido e fundo consistente.
 * O espaçamento (tokens clamp em tokens.css) encolhe em telas baixas e respira
 * nas grandes, sem breakpoints. Pareie com <Container> para limitar a largura.
 */
const sectionVariants = cva("w-full", {
  variants: {
    spacing: {
      none: "",
      sm: "py-section-sm",
      md: "py-section",
      lg: "py-section-lg",
    },
    tone: {
      transparent: "",
      app: "bg-background",
      card: "bg-card",
      muted: "bg-muted",
    },
  },
  defaultVariants: {
    spacing: "md",
    tone: "transparent",
  },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, spacing, tone, ...props }, ref) => (
    <section ref={ref} className={cn(sectionVariants({ spacing, tone }), className)} {...props} />
  )
);

Section.displayName = "Section";

export { Section, sectionVariants };
