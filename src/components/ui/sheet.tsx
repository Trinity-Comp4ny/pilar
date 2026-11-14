import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { deveFecharSheet } from "@/lib/gestos";
import { haptico } from "@/lib/haptico";
import { useRestaurarFoco } from "@/components/ui/useRestaurarFoco";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

/**
 * Alça no topo do sheet de baixo (celular): arrastar para baixo fecha, como nos apps nativos.
 * Só toque; o botão Fechar e o Esc seguem valendo. Fecha com 1/3 da altura ou num "flick".
 */
function AlcaArrastar() {
  const alcaRef = React.useRef<HTMLDivElement>(null);
  const estado = React.useRef<{ y: number; t: number; painel: HTMLElement; ultimoDy: number; v: number } | null>(null);

  const painelDaAlca = () => alcaRef.current?.parentElement as HTMLElement | null;

  const aoTocar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const painel = painelDaAlca();
    if (!painel) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    estado.current = { y: e.clientY, t: performance.now(), painel, ultimoDy: 0, v: 0 };
    painel.style.transition = "none";
  };

  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = estado.current;
    if (!st) return;
    const dy = Math.max(0, e.clientY - st.y);
    const agora = performance.now();
    st.v = (dy - st.ultimoDy) / Math.max(1, agora - st.t);
    st.ultimoDy = dy;
    st.t = agora;
    st.painel.style.transform = `translate3d(0, ${dy}px, 0)`;
  };

  const aoSoltar = () => {
    const st = estado.current;
    estado.current = null;
    if (!st) return;
    const altura = st.painel.getBoundingClientRect().height;
    if (deveFecharSheet(st.ultimoDy, altura, st.v)) {
      haptico("leve");
      // Termina a descida arrastada e entrega o fechamento ao Radix, sem a animação padrão
      // (ela recomeçaria do topo e daria um salto).
      st.painel.style.transition = "transform 0.18s ease-in";
      st.painel.style.transform = `translate3d(0, ${altura}px, 0)`;
      window.setTimeout(() => {
        st.painel.style.animation = "none";
        st.painel.querySelector<HTMLButtonElement>("[data-sheet-fechar]")?.click();
      }, 180);
      return;
    }
    st.painel.style.transition = "transform 0.2s ease-out";
    st.painel.style.transform = "";
  };

  return (
    <>
      <div
        ref={alcaRef}
        aria-hidden
        className="absolute left-1/2 top-0 z-10 flex h-6 w-28 -translate-x-1/2 touch-none justify-center pt-2"
        onPointerDown={aoTocar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>
      <SheetPrimitive.Close data-sheet-fechar className="sr-only" tabIndex={-1} aria-hidden />
    </>
  );
}

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
    const foco = useRestaurarFoco(onOpenAutoFocus, onCloseAutoFocus);
    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props} {...foco}>
          {side === "bottom" && <AlcaArrastar />}
          {children}
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
