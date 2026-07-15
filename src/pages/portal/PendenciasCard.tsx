import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileCheck, Clock, ChevronRight, ExternalLink } from "lucide-react";
import type { ClienteReceita } from "@/pages/cliente/useClienteProjetoData";

interface PendenciasCardProps {
  baseUrl: string;
  receitas: ClienteReceita[];
  portalEntregasPendentes: number;
}

export function PendenciasCard({ baseUrl, receitas, portalEntregasPendentes }: PendenciasCardProps) {
  const navigate = useNavigate();

  const hoje = new Date().toISOString().split("T")[0];
  const em7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const naoRecebidas = receitas.filter((r) => r.status !== "Recebido" && r.data_vencimento);
  const faturasAtrasadasList = naoRecebidas.filter((r) => r.data_vencimento < hoje);
  const faturasAtrasadas = faturasAtrasadasList.length;
  const faturasProximasVencimentoList = naoRecebidas.filter(
    (r) => r.data_vencimento >= hoje && r.data_vencimento <= em7dias
  );
  const faturasProximasVencimento = faturasProximasVencimentoList.length;

  const paymentLinkAtrasada = faturasAtrasadasList.find((r) => r.asaas_payment_url)?.asaas_payment_url ?? null;
  const paymentLinkProxima = faturasProximasVencimentoList.find((r) => r.asaas_payment_url)?.asaas_payment_url ?? null;

  const pendencias = {
    entregasPendentes: portalEntregasPendentes,
    faturasProximasVencimento,
    faturasAtrasadas,
  };

  const totalPendencias =
    pendencias.entregasPendentes + pendencias.faturasProximasVencimento + pendencias.faturasAtrasadas;

  if (totalPendencias === 0) {
    return (
      <Card className="border-brand/30 bg-brand/10">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-brand/20 flex items-center justify-center">
            <FileCheck className="h-4 w-4 text-ink" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Nada pendente</p>
            <p className="text-xs text-ink/60">Você está em dia com este projeto.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Você tem pendências</p>
            <p className="text-xs text-amber-700/80">
              {totalPendencias} {totalPendencias === 1 ? "item precisa" : "itens precisam"} da sua atenção.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {pendencias.entregasPendentes > 0 && (
            <button
              onClick={() => navigate(`${baseUrl}/entregas`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-amber-50 border border-amber-100 text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileCheck className="h-3.5 w-3.5 text-amber-700" />
                <span>
                  {pendencias.entregasPendentes} entrega{pendencias.entregasPendentes === 1 ? "" : "s"} para aprovar
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-amber-700" />
            </button>
          )}

          {pendencias.faturasAtrasadas > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`${baseUrl}/financeiro`)}
                className="flex-1 flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-red-50 border border-red-200 text-sm transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-red-700" />
                  <span className="text-red-800">
                    {pendencias.faturasAtrasadas} parcela{pendencias.faturasAtrasadas === 1 ? "" : "s"} em atraso
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-red-700" />
              </button>
              {paymentLinkAtrasada && (
                <a
                  href={paymentLinkAtrasada}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 min-h-11 sm:min-h-0 sm:py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  Pagar
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {pendencias.faturasProximasVencimento > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`${baseUrl}/financeiro`)}
                className="flex-1 flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-amber-50 border border-amber-100 text-sm transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-amber-700" />
                  <span>
                    {pendencias.faturasProximasVencimento} parcela
                    {pendencias.faturasProximasVencimento === 1 ? "" : "s"} vencendo em 7 dias
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-amber-700" />
              </button>
              {paymentLinkProxima && (
                <a
                  href={paymentLinkProxima}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 min-h-11 sm:min-h-0 sm:py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  Pagar
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface BadgePendenciasProps {
  count: number;
}

export function BadgePendencias({ count }: BadgePendenciasProps) {
  if (count === 0) return null;
  return (
    <Badge className="bg-amber-100 text-amber-800 border-amber-200 border text-[10px]">
      {count} pendente{count === 1 ? "" : "s"}
    </Badge>
  );
}
