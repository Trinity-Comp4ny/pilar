import { Eye } from "lucide-react";
import { toast } from "sonner";
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

const IMPERSONATABLE: UserRole[] = ["user"];

export function ImpersonationPicker() {
  const { realRole } = usePermissions();
  const { viewAsRole, startImpersonation, stopImpersonation } = useImpersonation();

  if (realRole !== "admin" && realRole !== "ultra_admin") return null;

  const handleStart = async (r: UserRole) => {
    try {
      await startImpersonation(r);
      toast.success(`Visualizando como ${ROLE_LABEL[r]}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao iniciar visualização";
      toast.error(msg);
    }
  };

  const handleStop = async () => {
    await stopImpersonation();
  };

  return (
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
              onClick={() => handleStart(r)}
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
  );
}
