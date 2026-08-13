import { type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, DollarSign, Tag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface FinanceItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  tipo: "despesa" | "receita";
  step: 1 | 2;
  setStep: (step: 1 | 2) => void;
  hasSelected: boolean;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onBack: () => void;
  step1: ReactNode;
  step2: ReactNode;
  parcelaBanner?: ReactNode;
  step1Description?: string;
  step2Description?: string;
}

const STEPS = [
  { id: 1 as const, label: "Identificação", icon: DollarSign },
  { id: 2 as const, label: "Classificação", icon: Tag },
];

export function FinanceItemForm({
  open,
  onOpenChange,
  isEdit,
  tipo,
  step,
  setStep,
  hasSelected,
  isSaving,
  onSubmit,
  onNext,
  onBack,
  step1,
  step2,
  parcelaBanner,
  step1Description = "Valor, data e forma de pagamento",
  step2Description = "Vínculos e categorias",
}: FinanceItemFormProps) {
  const titleNew = tipo === "despesa" ? "Nova Despesa" : "Nova Receita";
  const titleEdit = tipo === "despesa" ? "Editar Despesa" : "Editar Receita";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle>{isEdit ? titleEdit : titleNew}</DialogTitle>
            <DialogDescription>{step === 1 ? step1Description : step2Description}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              const isClickable = hasSelected || s.id <= step;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => isClickable && setStep(s.id)}
                    disabled={!isClickable}
                    className={cn(
                      "flex items-center gap-2 flex-1 p-2 rounded-lg transition-colors text-left",
                      isClickable && "hover:bg-muted",
                      !isClickable && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                        (isActive || isCompleted) && "bg-brand text-ink",
                        !isActive && !isCompleted && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <div className="hidden sm:block min-w-0">
                      <p
                        className={cn(
                          "text-xs font-medium truncate",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {s.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Passo {s.id}</p>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-px flex-1 mx-1", step > s.id ? "bg-brand" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 2) onSubmit(e);
          }}
          className="divide-y"
        >
          {step === 1 && parcelaBanner}
          {step === 1 ? step1 : step2}

          <div className="flex items-center gap-2 px-6 py-4 bg-muted/30">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <div className="flex-1" />
            {step === 2 && (
              <Button type="button" variant="outline" onClick={onBack} disabled={isSaving}>
                Voltar
              </Button>
            )}
            {step === 1 ? (
              <Button type="button" onClick={onNext} variant="brand">
                Próximo →
              </Button>
            ) : (
              <Button type="submit" variant="brand" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : isEdit ? (
                  "Atualizar"
                ) : (
                  "Salvar"
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ParcelaBannerProps {
  numero?: number | null;
  total?: number | null;
}

export function ParcelaBanner({ numero, total }: ParcelaBannerProps) {
  return (
    <div className="px-6 pt-4 pb-0">
      <div className="flex items-center gap-2 rounded-md border border-warning-mid-border bg-warning-soft px-3 py-2 text-xs text-warning-strong">
        <span className="font-medium">
          Parcela {numero ?? "?"} de {total ?? "?"}
        </span>
        <span className="text-warning-mid">— faz parte de um grupo. Editar aqui altera só esta parcela.</span>
      </div>
    </div>
  );
}

interface DeleteGroupDialogProps {
  target: { id: string; grupoId: string; label: string } | null;
  onCancel: () => void;
  onConfirm: (mode: "single" | "all") => void;
}

export function DeleteGroupDialog({ target, onCancel, onConfirm }: DeleteGroupDialogProps) {
  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir parcela do grupo?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta é a {target?.label}. Deseja excluir apenas esta parcela ou todas as parcelas do grupo?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-fill-attention hover:bg-fill-attention/90 text-fill-attention-foreground"
            onClick={() => onConfirm("single")}
          >
            Só esta parcela
          </AlertDialogAction>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={() => onConfirm("all")}
          >
            Todo o grupo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
