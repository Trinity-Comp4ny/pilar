import * as React from "react";

import { cn } from "@/lib/utils";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Largura máxima do conteúdo:
   * - `content` = 1080px (coluna de leitura/marketing).
   * - `wide`    = até 1600px fluido (heros, grids largos).
   * - `full`    = sem limite (faixa full-bleed).
   */
  width?: "content" | "wide" | "full";
}

/** Centraliza e limita a largura, com gutter lateral fluido (20px → 64px). */
const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, width = "content", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mx-auto w-full px-[clamp(1.25rem,4vw,4rem)]",
        width === "content" && "max-w-content",
        width === "wide" && "max-w-wide",
        className
      )}
      {...props}
    />
  )
);

Container.displayName = "Container";

export { Container };
