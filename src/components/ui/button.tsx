import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base premium: faixa de luz (sheen) que varre o botão no hover via ::before,
  // sem deslocamento vertical; "press" sutil no active; foco ring-2.
  // motion-reduce desliga sheen e press, mantendo só a troca de cor.
  "group/btn relative isolate inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transform-gpu transition-[box-shadow,background-color,border-color,color,transform] duration-fast ease-out-quint active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 before:pointer-events-none before:absolute before:inset-0 before:-translate-x-[150%] before:skew-x-[-20deg] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-slow before:ease-out-expo before:content-[''] hover:before:translate-x-[150%] motion-reduce:transition-colors motion-reduce:active:scale-100 motion-reduce:before:hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "before:hidden hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 before:hidden hover:underline",
        brand: "bg-brand text-ink hover:bg-brand/90",
        /** @deprecated nome legado; use "brand" (ADR 0008). Remover após a onda 1. */
        orange: "bg-brand text-ink hover:bg-brand/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Mostra um spinner antes do conteúdo e desabilita o botão. Substitui o par
   * manual `disabled={isPending}` + `<Loader2 className="animate-spin" />`.
   * Ignorado com `asChild` (o Slot exige um único filho).
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button className={classes} ref={ref} disabled={disabled || loading} {...props}>
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
