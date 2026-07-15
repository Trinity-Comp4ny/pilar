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
import { PROJECT_STATUS_CONFIG } from "@/constants";

const statusConfig = PROJECT_STATUS_CONFIG;

type PendingDrag = {
  projetoId: string;
  newStatus: string;
  projetoNome?: string;
} | null;

type PendingReopen = {
  projetoId: string;
  newStatus: string;
  projetoNome: string;
  dataFinal?: string;
} | null;

interface NotifyTeamDialogProps {
  pending: PendingDrag;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmação de notificação por email à equipe após mover o projeto de status.
export function NotifyTeamDialog({ pending, onOpenChange, onCancel, onConfirm }: NotifyTeamDialogProps) {
  return (
    <AlertDialog open={!!pending} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Notificar a equipe sobre a mudança de status?</AlertDialogTitle>
          <AlertDialogDescription>
            Mover o projeto para{" "}
            <strong>
              {pending
                ? (statusConfig[pending.newStatus as keyof typeof statusConfig]?.label ?? pending.newStatus)
                : ""}
            </strong>{" "}
            enviará e-mail para todos os membros alocados no projeto. O cliente não será notificado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Não notificar</AlertDialogCancel>
          <AlertDialogAction className="bg-brand hover:bg-brand/90 text-ink" onClick={onConfirm}>
            Sim, notificar equipe
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ReopenProjetoDialogProps {
  pending: PendingReopen;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmação de reabertura de projeto concluído (remove a data de conclusão).
export function ReopenProjetoDialog({ pending, onOpenChange, onCancel, onConfirm }: ReopenProjetoDialogProps) {
  return (
    <AlertDialog open={!!pending} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir projeto concluído?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{pending?.projetoNome}</strong> está marcado como concluído
            {pending?.dataFinal && (
              <>
                {" "}em <strong>{new Date(pending.dataFinal + "T00:00:00").toLocaleDateString("pt-BR")}</strong>
              </>
            )}
            . Movê-lo para{" "}
            <strong>
              {pending
                ? (statusConfig[pending.newStatus as keyof typeof statusConfig]?.label ?? pending.newStatus)
                : ""}
            </strong>{" "}
            vai <strong>remover a data de conclusão</strong>. Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-brand hover:bg-brand/90 text-ink" onClick={onConfirm}>
            Reabrir e remover data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
