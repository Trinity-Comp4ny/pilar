import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Zap, ExternalLink } from "lucide-react";
import { useAsaasCriarCobranca, type BillingType } from "@/hooks/useAsaas";

interface AsaasCobrancaButtonProps {
  receitaId: string;
  asaasPaymentUrl?: string | null;
  asaasPaymentStatus?: string | null;
  asaasBillingType?: string | null;
  onSuccess?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  OVERDUE: "Vencido",
  REFUNDED: "Devolvido",
  RECEIVED_IN_CASH: "Recebido em dinheiro",
  AWAITING_RISK_ANALYSIS: "Em análise",
};

export function AsaasCobrancaButton({
  receitaId,
  asaasPaymentUrl,
  asaasPaymentStatus,
  asaasBillingType,
  onSuccess,
}: AsaasCobrancaButtonProps) {
  const { criarCobranca, isLoading } = useAsaasCriarCobranca(onSuccess);

  const handleCriar = (billingType: BillingType) => {
    criarCobranca(receitaId, billingType);
  };

  // Cobrança já criada — mostrar link
  if (asaasPaymentUrl) {
    const statusLabel = asaasPaymentStatus ? (STATUS_LABEL[asaasPaymentStatus] ?? asaasPaymentStatus) : null;

    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
        onClick={() => window.open(asaasPaymentUrl, "_blank")}
      >
        <ExternalLink className="h-3 w-3" />
        {asaasBillingType === "PIX" ? "Pix" : "Boleto"} Asaas
        {statusLabel && <span className="text-blue-400">· {statusLabel}</span>}
      </Button>
    );
  }

  // Sem cobrança — dropdown para criar
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          Cobrar via Asaas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCriar("PIX")}>Pix</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCriar("BOLETO")}>Boleto</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
