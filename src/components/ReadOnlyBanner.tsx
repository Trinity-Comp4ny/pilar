import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsModal } from "@/contexts/SettingsModalContext";

// SPEC 098 Fase 3 (ADR 0042): trial vencido sem forma de pagamento entra em
// 90 dias de somente leitura antes da exclusão (ADR 0043), em vez de
// bloquear o acesso por completo como cancelamento/inadimplência.
export function ReadOnlyBanner({ isAdmin }: { isAdmin: boolean }) {
  const { openSettings } = useSettingsModal();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] bg-fill-warning text-fill-warning-foreground shadow-md"
    >
      <div className="px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <Lock className="w-4 h-4" strokeWidth={2} />
        <span className="font-medium">Somente leitura: o período de teste acabou</span>
        <span className="text-xs opacity-80 hidden sm:inline">
          seus dados continuam guardados, mas não podem ser editados
        </span>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-black hover:bg-black/10"
            onClick={() => openSettings("pagamento")}
          >
            Ver assinatura
          </Button>
        )}
      </div>
    </div>
  );
}
