import { createPortal } from "react-dom";
import { useAlvoFaixas } from "@/lib/faixasDoTopo";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ROLE_LABEL } from "@/lib/permissions";

export function ImpersonationBanner() {
  const alvo = useAlvoFaixas();
  const { viewAsRole, isImpersonating, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !viewAsRole) return null;

  const faixa = (
    <div role="status" aria-live="polite" className="bg-fill-warning text-fill-warning-foreground">
      <div className="px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <Eye className="w-4 h-4" strokeWidth={2} />
        <span className="font-medium">
          Visualizando como <span className="underline underline-offset-2">{ROLE_LABEL[viewAsRole]}</span>
        </span>
        <span className="text-xs opacity-80 hidden sm:inline">
          dados sensíveis seguem o papel simulado, não só o menu
        </span>
        <Button size="xs" variant="ghost" className="px-2 text-black hover:bg-black/10" onClick={stopImpersonation}>
          <X className="w-3.5 h-3.5 mr-1" />
          Sair
        </Button>
      </div>
    </div>
  );
  // No app, entra no bloco do topo (desce as páginas); fora dele, fixa por cima de tudo.
  return alvo ? createPortal(faixa, alvo) : <div className="fixed left-0 right-0 top-0 z-60 shadow-md">{faixa}</div>;
}
