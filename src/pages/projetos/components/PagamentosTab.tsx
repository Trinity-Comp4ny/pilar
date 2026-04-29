import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  DollarSign,
  TrendingUp,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePagamentosProjeto,
  useMarcarRecebido,
  getDiasStatus,
  type PagamentoProjeto,
} from "@/hooks/usePagamentosProjeto";
import { formatCurrency } from "@/lib/currencyUtils";

interface PagamentosTabProps {
  projetoId: string;
  canEdit: boolean;
}

type FiltroStatus = "todos" | "pendentes" | "atrasados" | "recebidos";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgCard: string; icon: typeof Clock }> = {
  Pendente: {
    label: "Pendente",
    color: "bg-yellow-100 text-yellow-800",
    bgCard: "border-l-yellow-400",
    icon: Clock,
  },
  Atrasado: {
    label: "Atrasado",
    color: "bg-red-100 text-red-800",
    bgCard: "border-l-red-500",
    icon: AlertTriangle,
  },
  Recebido: {
    label: "Recebido",
    color: "bg-green-100 text-green-800",
    bgCard: "border-l-green-500",
    icon: CheckCircle2,
  },
  Pago: {
    label: "Pago",
    color: "bg-green-100 text-green-800",
    bgCard: "border-l-green-500",
    icon: CheckCircle2,
  },
  Cancelado: {
    label: "Cancelado",
    color: "bg-gray-100 text-gray-600",
    bgCard: "border-l-gray-400",
    icon: XCircle,
  },
};

const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function StatusBadgeAlerta({ pagamento }: { pagamento: PagamentoProjeto }) {
  const { dias, tipo } = getDiasStatus(pagamento);
  const config = STATUS_CONFIG[pagamento.status] || STATUS_CONFIG.Pendente;

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
      {tipo === "atrasado" && <span className="text-[10px] font-medium text-red-600">{dias}d atrasado</span>}
      {tipo === "proximo" && dias <= 7 && (
        <span className="text-[10px] font-medium text-amber-600">vence em {dias}d</span>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  valor,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  valor: string;
  icon: typeof DollarSign;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{valor}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export function PagamentosTab({ projetoId, canEdit }: PagamentosTabProps) {
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const { data, isLoading } = usePagamentosProjeto(projetoId);
  const marcarRecebido = useMarcarRecebido();

  const pagamentos = data?.pagamentos ?? [];
  const resumo = data?.resumo;

  const filtrados = pagamentos.filter((p) => {
    if (filtro === "pendentes") return p.status === "Pendente";
    if (filtro === "atrasados")
      return p.status === "Atrasado" || (p.status === "Pendente" && getDiasStatus(p).tipo === "atrasado");
    if (filtro === "recebidos") return p.status === "Recebido" || p.status === "Pago";
    return true;
  });

  const handleMarcarRecebido = (receitaId: string) => {
    marcarRecebido.mutate(
      { receitaId },
      {
        onSuccess: () => toast.success("Pagamento marcado como recebido"),
        onError: () => toast.error("Erro"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Cards de resumo */}
        {resumo && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Valor do Contrato"
                valor={formatCurrency(resumo.totalContrato)}
                icon={DollarSign}
                color="bg-blue-100 text-blue-700"
              />
              <SummaryCard
                label="Total Recebido"
                valor={formatCurrency(resumo.totalRecebido)}
                icon={TrendingUp}
                color="bg-green-100 text-green-700"
                subtitle={`${resumo.percentualRecebido}% do contrato`}
              />
              <SummaryCard
                label="Pendente"
                valor={formatCurrency(resumo.totalPendente)}
                icon={CalendarClock}
                color="bg-yellow-100 text-yellow-700"
                subtitle={`${resumo.qtdPendentes} pagamento(s)`}
              />
              <SummaryCard
                label="Atrasado"
                valor={formatCurrency(resumo.totalAtrasado)}
                icon={AlertTriangle}
                color={resumo.qtdAtrasados > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}
                subtitle={resumo.qtdAtrasados > 0 ? `${resumo.qtdAtrasados} pagamento(s)` : "Nenhum atraso"}
              />
            </div>

            {/* Barra de progresso */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Recebimento do contrato</span>
                <span className="text-xs font-medium">{resumo.percentualRecebido}%</span>
              </div>
              <Progress value={resumo.percentualRecebido} className="h-2" />
            </div>

            {resumo.proximoVencimento && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
                <CalendarClock className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-amber-800">
                  Próximo vencimento: <strong>{formatDate(resumo.proximoVencimento)}</strong>
                </span>
              </div>
            )}
          </>
        )}

        {/* Filtro + Lista */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pagamentos</h3>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroStatus)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="atrasados">Atrasados</SelectItem>
              <SelectItem value="recebidos">Recebidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {pagamentos.length === 0
              ? "Nenhum pagamento registrado para este projeto."
              : "Nenhum pagamento encontrado com este filtro."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtrados.map((pag) => {
              const config = STATUS_CONFIG[pag.status] || STATUS_CONFIG.Pendente;
              const Icon = config.icon;
              const isPendente = pag.status === "Pendente" || pag.status === "Atrasado";

              return (
                <div
                  key={pag.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg border-l-4 ${config.bgCard}`}
                >
                  <div className={`p-1.5 rounded ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{pag.descricao}</p>
                      {pag.parcela_numero && pag.parcela_total && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {pag.parcela_numero}/{pag.parcela_total}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>Venc: {formatDate(pag.data_vencimento)}</span>
                      {pag.data_recebimento && <span>· Receb: {formatDate(pag.data_recebimento)}</span>}
                      {pag.nota_fiscal && <span>· NF: {pag.nota_fiscal}</span>}
                      {pag.forma_pagamento && <span>· {pag.forma_pagamento}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(pag.valor)}</p>
                    <StatusBadgeAlerta pagamento={pag} />
                  </div>

                  {canEdit && isPendente && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 shrink-0"
                      title="Marcar como recebido"
                      disabled={marcarRecebido.isPending}
                      onClick={() => handleMarcarRecebido(pag.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
