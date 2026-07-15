import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FinanceErrorStateProps {
  onRetry: () => void;
}

// Estado de erro explícito: uma query que falha não pode virar "R$ 0,00" como se
// fosse dado real. Mostra o que houve e oferece o próximo passo.
export function FinanceErrorState({ onRetry }: FinanceErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-64 text-center">
      <AlertCircle className="h-8 w-8 text-red-500" />
      <div>
        <p className="text-sm font-medium">Não foi possível carregar os dados financeiros</p>
        <p className="text-xs text-muted-foreground mt-1">Verifique a conexão e tente de novo.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
