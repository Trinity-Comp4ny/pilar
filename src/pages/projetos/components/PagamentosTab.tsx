import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { KPICard } from "@/components/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  DollarSign,
  TrendingUp,
  CalendarClock,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePagamentosProjeto,
  useMarcarRecebido,
  getDiasStatus,
  type PagamentoProjeto,
} from "@/hooks/usePagamentosProjeto";
import { formatCurrency } from "@/lib/currencyUtils";
import { statusBadgeClasses } from "@/lib/status";

interface PagamentosTabProps {
  projetoId: string;
  canEdit: boolean;
}

type FiltroStatus = "todos" | "pendentes" | "atrasados" | "recebidos";

// Cor do badge vem do registry único (financeiro), evitando mapa divergente.
// bgCard (accent lateral do card) não tem token equivalente no design system
// ainda; mantido cru (ver relatório do lote).
const STATUS_CONFIG: Record<string, { label: string; color: string; bgCard: string; icon: typeof Clock }> = {
  Pendente: {
    label: "Pendente",
    color: statusBadgeClasses("financeiro", "Pendente"),
    bgCard: "border-l-yellow-400",
    icon: Clock,
  },
  Atrasado: {
    label: "Atrasado",
    color: statusBadgeClasses("financeiro", "Atrasado"),
    bgCard: "border-l-red-500",
    icon: AlertTriangle,
  },
  Recebido: {
    label: "Recebido",
    color: statusBadgeClasses("financeiro", "Recebido"),
    bgCard: "border-l-green-500",
    icon: CheckCircle2,
  },
  Pago: {
    label: "Pago",
    color: statusBadgeClasses("financeiro", "Pago"),
    bgCard: "border-l-green-500",
    icon: CheckCircle2,
  },
  Cancelado: {
    label: "Cancelado",
    color: statusBadgeClasses("financeiro", "Cancelado"),
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
      {tipo === "atrasado" && <span className="text-[10px] font-medium text-danger-mid">{dias}d atrasado</span>}
      {tipo === "proximo" && dias <= 7 && (
        <span className="text-[10px] font-medium text-warning-mid">vence em {dias}d</span>
      )}
    </div>
  );
}

export function PagamentosTab({ projetoId, canEdit }: PagamentosTabProps) {
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [confirmId, setConfirmId] = useState<string | null>(null);
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

  const handleConfirmRecebido = () => {
    if (!confirmId) return;
    marcarRecebido.mutate(
      { receitaId: confirmId },
      {
        onSuccess: () => toast.success("Pagamento marcado como recebido"),
        onError: () => toast.error("Erro ao atualizar pagamento"),
        onSettled: () => setConfirmId(null),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <KPICard
                label="Valor do Contrato"
                value={formatCurrency(resumo.totalContrato)}
                icon={DollarSign}
                tone="neutral"
              />
              <KPICard
                label="Total Recebido"
                value={formatCurrency(resumo.totalRecebido)}
                icon={TrendingUp}
                tone="positive"
                subtitle={`${resumo.percentualRecebido}% do contrato`}
              />
              <KPICard
                label="Pendente"
                value={formatCurrency(resumo.totalPendente)}
                icon={CalendarClock}
                tone="warning"
                subtitle={`${resumo.qtdPendentes} pagamento(s)`}
              />
              <KPICard
                label="Atrasado"
                value={formatCurrency(resumo.totalAtrasado)}
                icon={AlertTriangle}
                tone={resumo.qtdAtrasados > 0 ? "danger" : "neutral"}
                subtitle={resumo.qtdAtrasados > 0 ? `${resumo.qtdAtrasados} pagamento(s)` : "Nenhum atraso"}
              />
            </div>

            {resumo.proximoVencimento && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning-soft border border-warning-mid-border">
                <CalendarClock className="h-4 w-4 text-warning-mid" />
                <span className="text-xs text-warning-strong">
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label="Ações do pagamento"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setConfirmId(pag.id)}>
                          <CheckCircle2 className="mr-2 h-4 w-4 text-positive-strong" />
                          Marcar como recebido
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recebimento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja marcar este pagamento como recebido? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRecebido} disabled={marcarRecebido.isPending}>
              {marcarRecebido.isPending ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
