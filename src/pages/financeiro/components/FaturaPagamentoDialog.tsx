import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencyUtils";
import { usePagarFatura } from "../hooks/usePagarFatura";
import type { Conta, Fatura } from "../hooks/useFaturas";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

interface FaturaPagamentoDialogProps {
  fatura: Fatura | null;
  contas: Conta[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
}

export function FaturaPagamentoDialog({ fatura, contas, open, onOpenChange, onPaid }: FaturaPagamentoDialogProps) {
  const [contaPagamentoId, setContaPagamentoId] = useState("");
  const [valorPagamento, setValorPagamento] = useState("");
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  const pagarMutation = usePagarFatura();

  // Prefill ao abrir: conta padrão do cartão e valor restante da fatura.
  // Ajuste de estado em render (padrão React) em vez de useEffect: reArma no
  // fechamento pra reabrir a mesma fatura sempre partir dos valores atuais.
  if (!open && prefilledFor !== null) {
    setPrefilledFor(null);
  } else if (open && fatura && fatura.id !== prefilledFor) {
    setPrefilledFor(fatura.id);
    setContaPagamentoId(fatura.conta_pagamento_id || "");
    setValorPagamento((fatura.valor_total - fatura.valor_pago).toFixed(2));
  }

  const handlePagar = () => {
    if (!fatura || !contaPagamentoId) {
      toast.error("Selecione a conta bancária");
      return;
    }

    const valor = parseFloat(valorPagamento);
    if (!valor || valor <= 0) {
      toast.error("Informe um valor de pagamento válido");
      return;
    }
    const restante = fatura.valor_total - fatura.valor_pago;
    if (valor > restante) {
      toast.error(`Valor acima do saldo devedor (${formatCurrency(restante)})`);
      return;
    }

    pagarMutation.mutate(
      { faturaId: fatura.id, contaId: contaPagamentoId, valor, dataPagamento: new Date() },
      {
        onSuccess: () => {
          toast.success("Fatura paga com sucesso!");
          onOpenChange(false);
          onPaid?.();
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Erro ao pagar fatura";
          toast.error(msg);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
          <DialogDescription>
            {fatura && `${fatura.cartao_nome} — ${MESES[fatura.mes_referencia - 1]} ${fatura.ano_referencia}`}
          </DialogDescription>
        </DialogHeader>
        {fatura && (
          <div className="space-y-4 mt-2">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor total da fatura</span>
                <span className="font-bold">R$ {formatBRL(fatura.valor_total)}</span>
              </div>
              {fatura.valor_pago > 0 && (
                <>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Já pago</span>
                    <span className="text-positive-strong">- R$ {formatBRL(fatura.valor_pago)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Restante</span>
                    <span>R$ {formatBRL(fatura.valor_total - fatura.valor_pago)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Conta bancária para pagamento</Label>
              <Select value={contaPagamentoId} onValueChange={setContaPagamentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor do pagamento (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valorPagamento}
                onChange={(e) => setValorPagamento(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe o valor total para pagamento integral ou altere para pagamento parcial.
              </p>
            </div>

            {!contaPagamentoId && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Selecione a conta bancária de onde o pagamento será debitado.</span>
              </div>
            )}

            <Button
              variant="brand"
              className="w-full rounded-full px-5 py-2.5 text-sm"
              onClick={handlePagar}
              disabled={pagarMutation.isPending || !contaPagamentoId}
            >
              {pagarMutation.isPending ? "Processando..." : "Confirmar pagamento"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
