import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FormDialog } from "@/components/FormDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PixPayment } from "@/pages/checkout/components/PixPayment";
import { BoletoPayment } from "@/pages/checkout/components/BoletoPayment";
import {
  useTokenPackCreate,
  type TokenPackBillingType,
  type TokenPackCreateResponse,
} from "@/components/settings/useTokenPackCreate";
import { useTokenPackStatus } from "@/components/settings/useTokenPackStatus";

const TOKENS_POR_PACOTE = 500_000;
const VALOR_POR_PACOTE = 49;

interface ComprarTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComprarTokensDialog({ open, onOpenChange }: ComprarTokensDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const createPack = useTokenPackCreate();

  const [quantidade, setQuantidade] = useState(1);
  const [billingType, setBillingType] = useState<TokenPackBillingType>("PIX");
  const [result, setResult] = useState<TokenPackCreateResponse | null>(null);

  const status = useTokenPackStatus(result?.purchase_id ?? null);
  const paid = status.data?.status === "paid";

  const reset = () => {
    setQuantidade(1);
    setBillingType("PIX");
    setResult(null);
    createPack.reset();
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    createPack.mutate(
      { quantidade_pacotes: quantidade, billing_type: billingType },
      { onSuccess: (data) => setResult(data) }
    );
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
                {formatNumber(result.tokens)} tokens já estão disponíveis no seu saldo.
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

  const totalTokens = quantidade * TOKENS_POR_PACOTE;
  const totalValor = quantidade * VALOR_POR_PACOTE;

  return (
    <FormDialog
      open={open}
      onOpenChange={handleClose}
      title="Comprar mais tokens"
      description="Pacote de 500 mil tokens, sem expiração. Pague por Pix ou boleto."
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Comprar"
      isPending={createPack.isPending}
      zClassName="z-[70]"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="quantidade-pacotes">Quantidade de pacotes</Label>
          <Input
            id="quantidade-pacotes"
            type="number"
            min={1}
            max={20}
            value={quantidade}
            onChange={(e) => {
              const next = Number(e.target.value);
              setQuantidade(Number.isFinite(next) ? Math.min(20, Math.max(1, next)) : 1);
            }}
          />
          <p className="text-xs text-black/45">
            {formatNumber(totalTokens)} tokens por {formatCurrency(totalValor)}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <RadioGroup value={billingType} onValueChange={(v) => setBillingType(v as TokenPackBillingType)}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="PIX" id="pack-pix" />
              <Label htmlFor="pack-pix" className="font-normal">
                Pix
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="BOLETO" id="pack-boleto" />
              <Label htmlFor="pack-boleto" className="font-normal">
                Boleto
              </Label>
            </div>
          </RadioGroup>
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
