import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ROLE_LABEL, type UserRole } from "@/lib/permissions";

export function ImpersonationPicker() {
  const { realRole } = usePermissions();
  const { viewAsRole, startImpersonation, stopImpersonation } = useImpersonation();

  if (realRole !== "admin" && realRole !== "ultra_admin") return null;

  // Ultra_admin também visualiza como admin (QA da visão de admin da empresa).
  // Admin comum só como usuário — impersonar admin seria escalonamento lateral,
  // e o backend (start_impersonation) recusa de qualquer forma.
  const impersonatable: UserRole[] = realRole === "ultra_admin" ? ["user", "admin"] : ["user"];

  // Inicia direto no clique. O antigo AlertDialog de confirmação vivia dentro do
  // dropdown e desmontava junto com ele ao selecionar o item, então nunca abria.
  // A ação é segura e reversível: fica registrada no servidor, expira em 30min e
  // o banner + "Sair da visualização" desfazem na hora.
  const handleStart = (r: UserRole) => {
    startImpersonation(r)
      .then(() =>
        toast.success(`Visualizando como ${ROLE_LABEL[r]}`, {
          description: 'Use "Sair da visualização" para voltar ao seu acesso.',
        })
      )
      .catch((err) =>
        toast.error("Não foi possível iniciar a visualização", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        })
      );
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Ver como...</DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {impersonatable.map((r) => (
            <DropdownMenuItem
              key={r}
              onClick={() => handleStart(r)}
              className={viewAsRole === r ? "bg-brand text-ink" : ""}
            >
              {ROLE_LABEL[r]}
              {viewAsRole === r && <span className="ml-auto text-xs">ativo</span>}
            </DropdownMenuItem>
          ))}
          {viewAsRole && (
            <DropdownMenuItem onClick={() => void stopImpersonation()} className="border-t mt-1">
              Sair da visualização
            </DropdownMenuItem>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
