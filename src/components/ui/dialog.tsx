import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRestaurarFoco } from "@/components/ui/useRestaurarFoco";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** Distância arrastada (px) a partir da qual soltar fecha o painel. */
const ARRASTE_PARA_FECHAR = 96;
/** Abaixo disto o gesto é um toque, não um arraste. */
const LIMIAR_DE_TOQUE = 6;

/**
 * Alça do painel de baixo (só no celular, SPEC 134). Toque fecha; arrastar para baixo
 * acompanha o dedo e fecha ao passar de `ARRASTE_PARA_FECHAR`. É o próprio botão de
 * fechar do Radix, então teclado e leitor de tela já funcionam.
 */
function SheetHandle() {
  const inicio = React.useRef<number | null>(null);
  const deslocado = React.useRef(0);

  const painel = (el: HTMLElement) => el.parentElement as HTMLElement;

  return (
    <DialogPrimitive.Close
      aria-label="Fechar"
      className="absolute left-1/2 top-0 z-10 flex h-8 w-20 -translate-x-1/2 touch-none items-start justify-center pt-2 md:hidden"
      onPointerDown={(e) => {
        inicio.current = e.clientY;
        deslocado.current = 0;
        e.currentTarget.setPointerCapture(e.pointerId);
        painel(e.currentTarget).style.transition = "none";
      }}
      onPointerMove={(e) => {
        if (inicio.current === null) return;
        deslocado.current = Math.max(0, e.clientY - inicio.current);
        painel(e.currentTarget).style.transform = `translateY(${deslocado.current}px)`;
      }}
      onPointerUp={(e) => {
        if (inicio.current === null) return;
        const alvo = painel(e.currentTarget);
        const foiArraste = deslocado.current > LIMIAR_DE_TOQUE;
        const fecha = deslocado.current > ARRASTE_PARA_FECHAR;
        inicio.current = null;
        alvo.style.transition = "";
        alvo.style.transform = "";
        if (foiArraste && fecha) e.currentTarget.dataset.fechar = "1";
      }}
      onPointerCancel={(e) => {
        inicio.current = null;
        const alvo = painel(e.currentTarget);
        alvo.style.transition = "";
        alvo.style.transform = "";
      }}
      onClick={(e) => {
        // Arraste curto que não chegou a fechar: o clique que o navegador gera não pode fechar.
        const fecha = e.currentTarget.dataset.fechar === "1";
        delete e.currentTarget.dataset.fechar;
        if (deslocado.current > LIMIAR_DE_TOQUE && !fecha) e.preventDefault();
      }}
    >
      <span aria-hidden="true" className="block h-1.5 w-10 rounded-full bg-muted-foreground/30" />
    </DialogPrimitive.Close>
  );
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    // Dialog aberto de dentro de outro dialog (ex.: SettingsDialog, z-60) precisa
    // do mesmo z-70 que o AlertDialog já usa pra "sempre no topo" (ver alert-dialog.tsx).
    overlayClassName?: string;
  }
>(({ className, overlayClassName, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const foco = useRestaurarFoco(onOpenAutoFocus, onCloseAutoFocus);
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Desktop (md+): modal central. Celular (SPEC 134): painel ancorado embaixo, que sobe.
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[min(100vw-2rem,900px)] max-h-[90dvh] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-4 sm:p-6 shadow-lg duration-200 outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          "max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[92dvh] max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[26px] max-md:border-x-0 max-md:border-b-0 max-md:px-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pt-8 max-md:duration-300 max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
        {...foco}
      >
        <SheetHandle />
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
