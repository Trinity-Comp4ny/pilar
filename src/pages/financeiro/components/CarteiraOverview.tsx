import { Button } from "@/components/ui/button";
import { CheckCircle2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Fatura } from "../hooks/useFaturas";
import type { ContaItem } from "../hooks/useContasCartoes";
import { MESES, vencimentoRelativo } from "./faturaHelpers";

interface CarteiraOverviewProps {
  contas: ContaItem[];
  faturas: Fatura[];
  onDetalhe: (fatura: Fatura) => void;
  onPagar: (fatura: Fatura) => void;
}

export function CarteiraOverview({ contas, faturas, onDetalhe, onPagar }: CarteiraOverviewProps) {
  const saldoTotal = contas.reduce((acc, c) => acc + (c.saldo_atual || 0), 0);
  const totalAPagar = faturas.reduce((acc, f) => acc + (f.valor_total - f.valor_pago), 0);

  return (
    <div className="space-y-6">
      {/* Resumo do topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-lg border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Saldo em contas</p>
          <p className="text-3xl font-bold">{formatCurrency(saldoTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {contas.length} conta{contas.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="p-5 rounded-lg border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Faturas a pagar</p>
          <p className={cn("text-3xl font-bold", totalAPagar > 0 && "text-negative-strong")}>{formatCurrency(totalAPagar)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {faturas.length} fatura{faturas.length === 1 ? "" : "s"} em aberto
          </p>
        </div>
      </div>

      {/* Faturas a pagar */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Faturas a pagar</h3>
        {faturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-positive" />
            <p className="text-sm">Nenhuma fatura em aberto. Tudo em dia.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {faturas.map((f) => {
              const restante = f.valor_total - f.valor_pago;
              const venc = vencimentoRelativo(f.status, f.data_vencimento);
              const isPagavel = f.status !== "Paga" && f.status !== "Aberta" && f.valor_total > 0;
              return (
                <button
                  key={f.id}
                  onClick={() => onDetalhe(f)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors hover:bg-muted/50"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: f.cartao_cor || "hsl(var(--chart-neutral))" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.cartao_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {MESES[f.mes_referencia - 1]} · vence {formatDateShort(f.data_vencimento)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs shrink-0 tabular-nums",
                      venc.vencida ? "text-danger-mid font-medium" : "text-muted-foreground"
                    )}
                  >
                    {venc.label}
                  </span>
                  <span className="text-sm font-semibold shrink-0 tabular-nums w-28 text-right">
                    {formatCurrency(restante)}
                  </span>
                  {isPagavel ? (
                    <Button
                      size="sm"
                      variant="brand"
                      className="rounded-full shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPagar(f);
                      }}
                    >
                      <DollarSign className="mr-1 h-4 w-4" />
                      Pagar
                    </Button>
                  ) : (
                    <span className="w-[92px] shrink-0" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
