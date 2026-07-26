import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency as fmtMoeda } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Receipt, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { ClienteReceita } from "@/pages/cliente/useClienteProjetoData";

export function FinanceiroContent({ receitas }: { receitas: ClienteReceita[] }) {
  const formatCurrency = (v: number) => fmtMoeda(v);
  const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

  // Data local (BRT) no formato YYYY-MM-DD para comparar vencimento sem erro de fuso.
  const agora = new Date();
  const hojeLocal = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
    agora.getDate()
  ).padStart(2, "0")}`;

  const totalPrevisto = receitas.reduce((s, r) => s + r.valor, 0);
  // "Pago" e "Recebido" contam como recebido (mesmo critério do resto do app).
  const totalPago = receitas
    .filter((r) => r.status === "Recebido" || r.status === "Pago")
    .reduce((s, r) => s + r.valor, 0);
  const totalPendente = receitas.filter((r) => r.status === "Pendente").reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total das parcelas</p>
            <p className="text-lg font-bold">{formatCurrency(totalPrevisto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-lg font-bold text-positive-strong">{formatCurrency(totalPago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-yellow-600">{formatCurrency(totalPendente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso de pagamento */}
      {totalPrevisto > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso de Pagamento</span>
              <span className="text-sm font-bold">{((totalPago / totalPrevisto) * 100).toFixed(0)}% pago</span>
            </div>
            <div
              className="w-full bg-gray-200 rounded-full h-3"
              role="progressbar"
              aria-valuenow={Math.round((totalPago / totalPrevisto) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso de pagamento"
            >
              <div
                className="bg-positive h-3 rounded-full transition-all"
                style={{ width: `${(totalPago / totalPrevisto) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de parcelas */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Parcelas</h3>
          {receitas.length === 0 ? (
            <EmptyState icon={Receipt} title="Nenhuma parcela registrada" />
          ) : (
            <div className="space-y-3">
              {receitas.map((r) => {
                const isRecebido = r.status === "Recebido";
                const isAtrasado = !isRecebido && !!r.data_vencimento && r.data_vencimento < hojeLocal;
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div
                      className={`p-1.5 rounded ${isRecebido ? "bg-positive/10 text-positive-strong" : isAtrasado ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                    >
                      {isRecebido ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{r.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento: {formatDate(r.data_vencimento)}
                        {r.data_recebimento && ` · Pago em: ${formatDate(r.data_recebimento)}`}
                      </p>
                    </div>
                    <div className="text-right space-y-1.5">
                      <p className="text-sm font-bold">{formatCurrency(r.valor)}</p>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {!isRecebido && r.asaas_billing_type && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-800">
                            {r.asaas_billing_type === "PIX" ? "PIX" : "Boleto"}
                          </Badge>
                        )}
                        <Badge
                          className={`text-[10px] ${isRecebido ? "bg-positive/10 text-positive-strong" : isAtrasado ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                        >
                          {isRecebido ? "Pago" : isAtrasado ? "Atrasado" : "Pendente"}
                        </Badge>
                      </div>
                      {!isRecebido && r.asaas_payment_url && (
                        <Button asChild size="sm" variant="brand" className="h-11 sm:h-8 text-xs px-3">
                          <a href={r.asaas_payment_url} target="_blank" rel="noopener noreferrer">
                            Pagar agora
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
