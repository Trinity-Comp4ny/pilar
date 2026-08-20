import { buttonVariants } from "@/components/ui/button";
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
