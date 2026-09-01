import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Modal de formulário padrão (Pilar Design System, seções 4 e 5).
 * Padroniza largura, footer Cancelar/Salvar, scroll e estado de envio. As
 * larguras oficiais são só sm/md/lg; não montar DialogContent + footer à mão.
 */
const SIZE = {
  sm: "max-w-sm", // confirmação, 1-2 campos
  md: "max-w-lg", // formulário padrão (default)
  lg: "max-w-3xl", // formulário denso, com colunas ou tabela interna
} as const;

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: keyof typeof SIZE;
  /** Disparado no submit do form (o preventDefault já é aplicado). */
  onSubmit: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitVariant?: "brand" | "destructive";
  /** Trava os botões e mostra spinner no submit durante a ação. */
  isPending?: boolean;
  /** Desabilita só o submit (validação client) sem estado de loading. */
  submitDisabled?: boolean;
  /** Dialog aberto de dentro de outro dialog (ex.: SettingsDialog, z-60): "z-[70]" nos dois. */
  zClassName?: string;
  children: React.ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  onSubmit,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  submitVariant = "brand",
  isPending = false,
  submitDisabled = false,
  zClassName,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      {/* max-w vem por último no cn: tailwind-merge sobrepõe o default do DialogContent. */}
      <DialogContent className={cn(SIZE[size], zClassName)} overlayClassName={zClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                {cancelLabel}
              </Button>
            </DialogClose>
            <Button type="submit" variant={submitVariant} loading={isPending} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
