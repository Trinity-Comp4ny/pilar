import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DollarSign } from "lucide-react";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/format";
import { useDespesasFatura, type Fatura } from "../hooks/useFaturas";
import { MESES, getStatusBadge } from "./faturaHelpers";

interface FaturaDetailDialogProps {
  fatura: Fatura | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPagar: (fatura: Fatura) => void;
}

export function FaturaDetailDialog({ fatura, open, onOpenChange, onPagar }: FaturaDetailDialogProps) {
  const { data: despesasFatura = [] } = useDespesasFatura(fatura?.id ?? null);
  const isPagavel = !!fatura && fatura.status !== "Paga" && fatura.status !== "Aberta" && fatura.valor_total > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Fatura {fatura && `${MESES[fatura.mes_referencia - 1]} ${fatura.ano_referencia}`}
          </DialogTitle>
          <DialogDescription>
            {fatura && `${fatura.cartao_nome} — ${fatura.qtd_despesas} despesa(s)`}
          </DialogDescription>
        </DialogHeader>
        {fatura && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(fatura.status, fatura.data_vencimento)}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="text-sm font-bold mt-1">{formatCurrency(fatura.valor_total)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className="text-sm font-medium mt-1">
                  {formatDate(fatura.data_vencimento)}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Ciclo</p>
                <p className="text-sm mt-1">
                  {formatDateShort(fatura.data_inicio)} a{" "}
                  {formatDateShort(fatura.data_fim)}
                </p>
              </div>
            </div>

            {fatura.data_pagamento && (
              <div className="p-3 bg-positive/10 rounded-lg text-sm text-positive-strong">
                Paga em {formatDate(fatura.data_pagamento)}
                {fatura.conta_pagamento_nome && ` via ${fatura.conta_pagamento_nome}`}
              </div>
            )}

            <Separator />

            {/* Lista de despesas */}
            <div>
              <h4 className="text-sm font-medium mb-3">Despesas nesta fatura</h4>
              {despesasFatura.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma despesa encontrada.</p>
              ) : (
                <div className="space-y-2">
                  {despesasFatura.map((d) => (
                    <div key={d.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{d.descricao}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatDate(d.data_vencimento)}</span>
                          {d.categorias_financeiras?.nome && <span>| {d.categorias_financeiras.nome}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatCurrency(d.valor)}</span>
                        <Badge variant={d.status === "Pago" ? "default" : "secondary"} className="text-xs">
                          {d.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações */}
            {isPagavel && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor restante</p>
                    <p className="text-lg font-bold">{formatCurrency(fatura.valor_total - fatura.valor_pago)}</p>
                  </div>
                  <Button
                    variant="brand"
                    className="rounded-full px-5 py-2.5 text-sm"
                    onClick={() => onPagar(fatura)}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pagar fatura
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
