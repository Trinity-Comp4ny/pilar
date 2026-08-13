import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status por intenção (ADR 0008 D3): fundo suave + texto forte (AA nos tokens).
        // Espelham os tons do registry lib/status.ts (TONE_BADGE). Use estas em vez
        // de colar bg-*-100/text-*-800 cru; para status de domínio prefira <StatusBadge>.
        brand: "border-transparent bg-brand text-ink",
        success: "border-transparent bg-success-soft text-success-strong",
        warning: "border-transparent bg-warning-soft text-warning-strong",
        info: "border-transparent bg-info-soft text-info-strong",
        attention: "border-transparent bg-attention-soft text-attention-strong",
        highlight: "border-transparent bg-highlight-soft text-highlight-strong",
        danger: "border-transparent bg-danger-soft text-danger-strong",
        neutral: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
  return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});
Badge.displayName = "Badge";

export { Badge, badgeVariants };
