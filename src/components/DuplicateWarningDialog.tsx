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
import { formatDateDisplay } from "@/lib/dateUtils";
import type { DuplicateMatch } from "@/lib/duplicateCheck";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  onConfirm: () => void;
}

export function DuplicateWarningDialog({ open, onOpenChange, duplicates, onConfirm }: DuplicateWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Possível duplicata detectada</AlertDialogTitle>
          <AlertDialogDescription>
            {duplicates.length === 1
              ? "Foi encontrado 1 lançamento similar já cadastrado:"
              : `Foram encontrados ${duplicates.length} lançamentos similares já cadastrados:`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-48 overflow-y-auto space-y-2 my-2">
          {duplicates.map((dup) => (
            <div key={dup.id} className="rounded-md border p-3 text-sm bg-warning-soft border-warning-mid-border">
              <p className="font-medium">{dup.descricao}</p>
              <p className="text-muted-foreground">
                R$ {dup.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                {" — "}
                {formatDateDisplay(dup.data_vencimento)}
                {" — "}
                {dup.status}
              </p>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-brand hover:bg-brand/90">
            Salvar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
