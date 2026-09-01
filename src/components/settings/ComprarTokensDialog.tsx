import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FormDialog } from "@/components/FormDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumberCompact } from "@/lib/format";
import { PixPayment } from "@/pages/checkout/components/PixPayment";
import { BoletoPayment } from "@/pages/checkout/components/BoletoPayment";
import {
  useTokenPackCreate,
  type TokenPackBillingType,
  type TokenPackCreateResponse,
  type TokenPackTierId,
} from "@/components/settings/useTokenPackCreate";
import { useTokenPackStatus } from "@/components/settings/useTokenPackStatus";

// Espelha o catálogo do backend (pilar-token-pack-create) só pra exibição — o preço
// que vale de verdade é sempre resolvido no servidor a partir do tier_id (SPEC 080).
const TIER_CATALOG: Record<TokenPackTierId, { tokens: number; valorCentavos: number; label: string }> = {
  starter: { tokens: 500_000, valorCentavos: 4900, label: "500 mil tokens" },
  cresce: { tokens: 1_500_000, valorCentavos: 12900, label: "1,5 milhão de tokens" },
  escala: { tokens: 3_000_000, valorCentavos: 22800, label: "3 milhões de tokens" },
  maximo: { tokens: 6_000_000, valorCentavos: 39900, label: "6 milhões de tokens" },
};

const TIER_ORDER: TokenPackTierId[] = ["starter", "cresce", "escala", "maximo"];
const BASE_RATE = TIER_CATALOG.starter.valorCentavos / TIER_CATALOG.starter.tokens;

function descontoPct(tierId: TokenPackTierId): number {
  const tier = TIER_CATALOG[tierId];
  const taxa = tier.valorCentavos / tier.tokens;
  return Math.round((1 - taxa / BASE_RATE) * 100);
}

interface ComprarTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComprarTokensDialog({ open, onOpenChange }: ComprarTokensDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const createPack = useTokenPackCreate();

  const [tierId, setTierId] = useState<TokenPackTierId>("cresce");
  const [billingType, setBillingType] = useState<TokenPackBillingType>("PIX");
  const [result, setResult] = useState<TokenPackCreateResponse | null>(null);

  const status = useTokenPackStatus(result?.purchase_id ?? null);
  const paid = status.data?.status === "paid";

  const reset = () => {
    setTierId("cresce");
    setBillingType("PIX");
    setResult(null);
    createPack.reset();
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    createPack.mutate({ tier_id: tierId, billing_type: billingType }, { onSuccess: (data) => setResult(data) });
  };

  if (paid && result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm z-[70]" overlayClassName="z-[70]">
          <div className="text-center space-y-4 py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand/10 text-positive-strong">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">Tokens creditados</h3>
              <p className="text-sm text-black/55 mt-1">
                {formatNumberCompact(result.tokens)} tokens já estão disponíveis no seu saldo.
              </p>
            </div>
            <Button
              variant="brand"
              className="rounded-full"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["uso-empresa", profile?.empresa_id] });
                handleClose(false);
              }}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm z-[70]" overlayClassName="z-[70]">
          <DialogHeader>
            <DialogTitle className="sr-only">Pagamento do pacote de tokens</DialogTitle>
          </DialogHeader>
          {/* overflow-hidden aqui: item de grid (DialogContent) com texto mono longo
              (payload Pix) sem isso ignora a largura do dialog e estica pra caber o
              conteúdo (min-width:auto propaga por flex/grid aninhado); overflow != visible
              zera o tamanho mínimo automático do item e o truncate interno passa a valer. */}
          <div className="overflow-hidden">
            {result.billing_type === "PIX" && result.metadata.pix ? (
              <PixPayment
                encodedImage={result.metadata.pix.encoded_image}
                payload={result.metadata.pix.payload}
                expirationDate={result.metadata.pix.expiration_date}
                value={result.value}
                isPolling={status.isFetching || !status.data}
              />
            ) : result.billing_type === "BOLETO" && result.metadata.boleto ? (
              <BoletoPayment
                bankSlipUrl={result.metadata.boleto.bank_slip_url}
                identificationField={result.metadata.boleto.identification_field}
                value={result.value}
                isPolling={status.isFetching || !status.data}
              />
            ) : (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-black/30" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleClose}
      title="Comprar mais tokens"
      description="Sem expiração no ciclo. Quanto maior o pacote, menor o preço por token."
      size="md"
      onSubmit={handleSubmit}
      submitLabel="Comprar"
      isPending={createPack.isPending}
      zClassName="z-[70]"
    >
      <div className="space-y-5">
        <div
          role="radiogroup"
          aria-label="Quantidade de tokens"
          className="grid grid-cols-2 gap-3"
        >
          {TIER_ORDER.map((id) => {
            const tier = TIER_CATALOG[id];
            const desconto = descontoPct(id);
            const selected = tierId === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTierId(id)}
                className={cn(
                  "relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                  selected ? "border-brand bg-brand/5" : "border-black/10 hover:border-black/20"
                )}
              >
                {desconto > 0 && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-ink">
                    -{desconto}%
                  </span>
                )}
                <span className="text-sm font-semibold text-ink">{tier.label}</span>
                <span className="text-lg font-semibold text-ink">
                  {formatCurrency(tier.valorCentavos / 100, { decimals: 2 })}
                </span>
                <span className="text-xs text-black/45">
                  {formatCurrency((tier.valorCentavos / tier.tokens) * 1_000_000, { decimals: 2 })}/milhão
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Forma de pagamento</span>
          <div
            role="tablist"
            aria-label="Forma de pagamento"
            className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.02] p-1"
          >
            {(["PIX", "BOLETO"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={billingType === type}
                onClick={() => setBillingType(type)}
                className={cn(
                  "px-5 py-1.5 rounded-full text-sm font-medium transition-colors",
                  billingType === type ? "bg-white text-ink shadow-sm" : "text-black/50 hover:text-ink"
                )}
              >
                {type === "PIX" ? "Pix" : "Boleto"}
              </button>
            ))}
          </div>
        </div>

        {createPack.isError && (
          <p className="text-sm text-danger-strong bg-danger-soft border border-danger-mid-border rounded-lg p-3">
            {(createPack.error as Error).message}
          </p>
        )}
      </div>
    </FormDialog>
  );
}
