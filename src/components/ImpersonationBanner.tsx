import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ROLE_LABEL } from "@/lib/permissions";

export function ImpersonationBanner() {
  const { viewAsRole, isImpersonating, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !viewAsRole) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-black shadow-md"
    >
      <div className="px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <Eye className="w-4 h-4" strokeWidth={2} />
        <span className="font-medium">
          Visualizando como <span className="underline underline-offset-2">{ROLE_LABEL[viewAsRole]}</span>
        </span>
        <span className="text-xs opacity-80 hidden sm:inline">— apenas UI; RLS mantém permissões reais</span>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-black hover:bg-black/10" onClick={stopImpersonation}>
          <X className="w-3.5 h-3.5 mr-1" />
          Sair
        </Button>
      </div>
    </div>
  );
}
