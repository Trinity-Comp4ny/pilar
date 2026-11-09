import { useNavigate } from "react-router-dom";
import { addDays, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileCheck, Clock, ChevronRight } from "lucide-react";
import type { ClienteReceita } from "@/pages/cliente/useClienteProjetoData";

interface PendenciasCardProps {
  baseUrl: string;
  receitas: ClienteReceita[];
  portalEntregasPendentes: number;
}

export function PendenciasCard({ baseUrl, receitas, portalEntregasPendentes }: PendenciasCardProps) {
  const navigate = useNavigate();

  // Datas locais (YYYY-MM-DD): toISOString (UTC) à noite já cai no dia seguinte e
  // marcava como atrasada a parcela que vence hoje.
  const hoje = format(new Date(), "yyyy-MM-dd");
  const em7dias = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const naoRecebidas = receitas.filter((r) => r.status !== "Recebido" && r.data_vencimento);
  const faturasAtrasadasList = naoRecebidas.filter((r) => r.data_vencimento < hoje);
  const faturasAtrasadas = faturasAtrasadasList.length;
  const faturasProximasVencimentoList = naoRecebidas.filter(
    (r) => r.data_vencimento >= hoje && r.data_vencimento <= em7dias
  );
  const faturasProximasVencimento = faturasProximasVencimentoList.length;

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
    <Card className="border-warning-mid-border bg-warning-soft/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-warning-soft flex items-center justify-center shrink-0">
            <AlertCircle className="h-4 w-4 text-warning-mid" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warning-strong">Você tem pendências</p>
            <p className="text-xs text-warning-mid/80">
              {totalPendencias} {totalPendencias === 1 ? "item precisa" : "itens precisam"} da sua atenção.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {pendencias.entregasPendentes > 0 && (
            <button
              onClick={() => navigate(`${baseUrl}/entregas`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-warning-soft border border-warning-soft-border text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileCheck className="h-3.5 w-3.5 text-warning-mid" />
                <span>
                  {pendencias.entregasPendentes} entrega{pendencias.entregasPendentes === 1 ? "" : "s"} para aprovar
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-warning-mid" />
            </button>
          )}

          {pendencias.faturasAtrasadas > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`${baseUrl}/financeiro`)}
                className="flex-1 flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-danger-soft border border-danger-mid-border text-sm transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-danger-strong" />
                  <span className="text-danger-strong">
                    {pendencias.faturasAtrasadas} parcela{pendencias.faturasAtrasadas === 1 ? "" : "s"} em atraso
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-danger-strong" />
              </button>
            </div>
          )}

          {pendencias.faturasProximasVencimento > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`${baseUrl}/financeiro`)}
                className="flex-1 flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-warning-soft border border-warning-soft-border text-sm transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-warning-mid" />
                  <span>
                    {pendencias.faturasProximasVencimento} parcela
                    {pendencias.faturasProximasVencimento === 1 ? "" : "s"} vencendo em 7 dias
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-warning-mid" />
              </button>
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
    <Badge variant="warning" className="text-[10px]">
      {count} pendente{count === 1 ? "" : "s"}
    </Badge>
  );
}
