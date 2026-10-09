import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  // value vai também para o Root: sem ele o Radix marca a barra como indeterminada e o
  // leitor de tela não anuncia o percentual. Rótulo padrão para a barra nunca ficar sem
  // nome; quem tiver contexto melhor passa aria-label ou aria-labelledby.
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    aria-label={props["aria-labelledby"] ? undefined : "Progresso"}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
