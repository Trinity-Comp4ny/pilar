import { Eye } from "lucide-react";
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

  if (realRole !== "admin") return null;

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
              onClick={() => startImpersonation(r)}
              className={viewAsRole === r ? "bg-accent-orange/10 text-accent-orange" : ""}
            >
              {ROLE_LABEL[r]}
              {viewAsRole === r && <span className="ml-auto text-xs">ativo</span>}
            </DropdownMenuItem>
          ))}
          {viewAsRole && (
            <DropdownMenuItem onClick={stopImpersonation} className="border-t mt-1">
              Sair da visualização
            </DropdownMenuItem>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
