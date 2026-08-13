import { Loader2, AlertTriangle } from "lucide-react";
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
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useSubscriptionManage } from "../hooks/useSubscriptionManage";
import type { MySubscription } from "../hooks/useMySubscription";

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: MySubscription;
}

export function CancelDialog({ open, onOpenChange, current }: CancelDialogProps) {
  const manage = useSubscriptionManage();

  const periodEnd = current.current_period_end
    ? new Date(current.current_period_end).toLocaleDateString("pt-BR")
    : null;

  const handleConfirm = () => {
    manage.mutate(
      { action: "cancel" },
      {
        onSuccess: () => {
          toast.success("Assinatura cancelada", {
            description: periodEnd ? `Acesso mantido até ${periodEnd}.` : "Acesso mantido até o fim do período atual.",
          });
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error("Não foi possível cancelar a assinatura", {
            description: getSafeErrorMessage(err, "Tente de novo em instantes."),
          });
        },
      }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-warning-soft flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-mid" />
            </div>
            <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            A assinatura do Pilar {current.plan?.nome} será encerrada. Nenhuma nova cobrança será gerada.
            {periodEnd && (
              <>
                {" "}
                O acesso continua até <strong>{periodEnd}</strong>, quando o período atual termina.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={manage.isPending}>Manter assinatura</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={manage.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {manage.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...
              </>
            ) : (
              "Cancelar assinatura"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
