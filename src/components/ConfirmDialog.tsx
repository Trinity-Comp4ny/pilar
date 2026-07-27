import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { cn } from "@/lib/utils";

/**
 * Único caminho de confirmação do app (ADR 0008, spec 003 onda 2).
 * Não montar AlertDialog cru para confirmar ação: use este componente.
 * `description` aceita ReactNode para os casos com contexto extra (valores,
 * consequências), sem precisar de dialog próprio.
 */
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  /** Destacado acima da descrição (nome do registro que será afetado). */
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  /** Trava os botões e mostra spinner no confirmar durante a ação. */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "destructive",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {itemName && (
                <p className="font-medium text-foreground bg-muted rounded px-2 py-1 text-sm truncate">
                  &ldquo;{itemName}&rdquo;
                </p>
              )}
              {typeof description === "string" ? <p>{description}</p> : description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            // Cor vem da variant do Button (token), nunca de paleta crua.
            className={cn(variant === "destructive" && buttonVariants({ variant: "destructive" }))}
          >
            {loading ? <Spinner size="sm" className="text-current" /> : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
