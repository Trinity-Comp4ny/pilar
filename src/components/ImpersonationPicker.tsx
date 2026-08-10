import { useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
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
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ROLE_LABEL, type UserRole } from "@/lib/permissions";

const IMPERSONATABLE: UserRole[] = ["user"];

export function ImpersonationPicker() {
  const { realRole } = usePermissions();
  const { viewAsRole, startImpersonation, stopImpersonation } = useImpersonation();
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [starting, setStarting] = useState(false);

  if (realRole !== "admin" && realRole !== "ultra_admin") return null;

  const handleConfirm = async () => {
    if (!pendingRole) return;
    setStarting(true);
    try {
      await startImpersonation(pendingRole);
      toast.success(`Visualizando como ${ROLE_LABEL[pendingRole]}`);
      setPendingRole(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao iniciar visualização";
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    await stopImpersonation();
  };

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Eye size={14} className="mr-2" />
          Ver como...
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            {IMPERSONATABLE.map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => setPendingRole(r)}
                className={viewAsRole === r ? "bg-brand text-ink" : ""}
              >
                {ROLE_LABEL[r]}
                {viewAsRole === r && <span className="ml-auto text-xs">ativo</span>}
              </DropdownMenuItem>
            ))}
            {viewAsRole && (
              <DropdownMenuItem onClick={handleStop} className="border-t mt-1">
                Sair da visualização
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>

      <AlertDialog
        open={pendingRole !== null}
        onOpenChange={(o) => {
          if (!o && !starting) setPendingRole(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entrar no modo visualização?</AlertDialogTitle>
            <AlertDialogDescription>
              Você passa a navegar como {pendingRole ? ROLE_LABEL[pendingRole] : ""}, com o mesmo acesso desse
              perfil. A sessão fica registrada e expira em 30 minutos. Para voltar ao seu acesso, use "Sair da
              visualização".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={starting}
            >
              {starting ? "Entrando..." : `Entrar como ${pendingRole ? ROLE_LABEL[pendingRole] : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
