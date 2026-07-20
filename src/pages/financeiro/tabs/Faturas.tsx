import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Receipt, Calendar, DollarSign, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCartoesResumo, useContas, useFaturas, useDespesasFatura, useInvalidateFaturas, gerarFaturasCartao, type Fatura } from "../hooks/useFaturas";
import { usePagarFatura } from "../hooks/usePagarFatura";
import { FinanceErrorState } from "../components/FinanceErrorState";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

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

function getStatusBadge(status: string, dataVencimento: string) {
  const isOverdue = status !== "Paga" && new Date(dataVencimento) < new Date();

  if (status === "Paga") return <Badge className="bg-positive/10 text-positive-strong hover:bg-positive/10">Paga</Badge>;
  if (isOverdue) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Vencida</Badge>;
  if (status === "Parcial") return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Parcial</Badge>;
  if (status === "Fechada") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Fechada</Badge>;
  return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Aberta</Badge>;
}

export default function Faturas() {
  const {
    data: cartoes = [],
    isLoading: loadingCartoes,
    isError: errorCartoes,
    refetch: refetchCartoes,
  } = useCartoesResumo();
  const { data: contas = [] } = useContas();

  const [selectedCartaoId, setSelectedCartaoId] = useState<string>("");

  // Auto-select primeiro cartão quando carregar
  useEffect(() => {
    if (!selectedCartaoId && cartoes.length > 0) {
      setSelectedCartaoId(cartoes[0].id);
    }
  }, [cartoes, selectedCartaoId]);

  const { data: faturas = [], isLoading: loadingFaturas, error: faturasError } = useFaturas(selectedCartaoId || null);
  const invalidateFaturas = useInvalidateFaturas();

  useEffect(() => {
    if (!selectedCartaoId) return;
    void gerarFaturasCartao(selectedCartaoId)
      .then(() => invalidateFaturas())
      .catch((err) => {
        const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Erro ao gerar faturas";
        toast.error("Erro ao carregar faturas", { description: msg });
      });
  }, [selectedCartaoId, invalidateFaturas]);

  // Detail dialog
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { data: despesasFatura = [] } = useDespesasFatura(selectedFatura?.id ?? null);

  // Payment dialog
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [contaPagamentoId, setContaPagamentoId] = useState("");
  const [valorPagamento, setValorPagamento] = useState("");

  const pagarMutation = usePagarFatura();

  const handleOpenDetail = (fatura: Fatura) => {
    setSelectedFatura(fatura);
    setIsDetailOpen(true);
  };

  const handleOpenPagamento = (fatura: Fatura) => {
    setSelectedFatura(fatura);
    const cartao = cartoes.find((c) => c.id === fatura.cartao_id);
    setContaPagamentoId(cartao?.conta_pagamento_id || "");
    const restante = fatura.valor_total - fatura.valor_pago;
    setValorPagamento(restante.toFixed(2));
    setIsPagamentoOpen(true);
  };

  const handlePagar = () => {
    if (!selectedFatura || !contaPagamentoId) {
      toast.error("Selecione a conta bancária");
      return;
    }

    const valor = parseFloat(valorPagamento);
    if (!valor || valor <= 0) {
      toast.error("Informe um valor de pagamento válido");
      return;
    }
    const restante = selectedFatura.valor_total - selectedFatura.valor_pago;
    if (valor > restante) {
      toast.error(`Valor acima do saldo devedor (${formatCurrency(restante)})`);
      return;
    }

    pagarMutation.mutate(
      {
        faturaId: selectedFatura.id,
        contaId: contaPagamentoId,
        valor,
        dataPagamento: new Date(),
      },
      {
        onSuccess: () => {
          toast.success("Fatura paga com sucesso!");
          setIsPagamentoOpen(false);
          setIsDetailOpen(false);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Erro ao pagar fatura";
          toast.error(msg);
        },
      }
    );
  };

  const selectedCartao = cartoes.find((c) => c.id === selectedCartaoId);

  const faturaColumns: ColumnDef<Fatura>[] = [
    {
      key: "referencia",
      header: "Referência",
      stickyLeft: true,
      getSortValue: (f) => f.ano_referencia * 100 + f.mes_referencia,
      cell: (f) => (
        <span className="font-medium">
          {MESES[f.mes_referencia - 1]} {f.ano_referencia}
        </span>
      ),
    },
    {
      key: "ciclo",
      header: "Ciclo",
      cell: (f) => (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {format(new Date(f.data_inicio + "T00:00:00"), "dd/MM")} a{" "}
          {format(new Date(f.data_fim + "T00:00:00"), "dd/MM")}
        </span>
      ),
    },
    {
      key: "vencimento",
      header: "Vencimento",
      getSortValue: (f) => f.data_vencimento,
      cell: (f) => format(new Date(f.data_vencimento + "T00:00:00"), "dd/MM/yyyy"),
    },
    {
      key: "despesas",
      header: "Despesas",
      align: "center",
      getSortValue: (f) => f.qtd_despesas,
      cell: (f) => f.qtd_despesas,
    },
    {
      key: "valor",
      header: "Valor total",
      align: "end",
      getSortValue: (f) => f.valor_total,
      cell: (f) => {
        const restante = f.valor_total - f.valor_pago;
        return (
          <div className="text-right">
            <p className="font-semibold">
              R$ {f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            {f.valor_pago > 0 && f.status !== "Paga" && (
              <p className="text-xs text-muted-foreground">
                Restante: R$ {restante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (f) => getStatusBadge(f.status, f.data_vencimento),
    },
    {
      key: "acao",
      header: "",
      align: "end",
      cell: (f) => {
        const isPagavel = f.status !== "Paga" && f.status !== "Aberta" && f.valor_total > 0;
        return (
          <div className="flex items-center justify-end gap-2">
            {isPagavel && (
              <Button
                size="sm"
                className="rounded-full bg-brand text-ink hover:bg-brand/90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenPagamento(f);
                }}
              >
                <DollarSign className="mr-1 h-4 w-4" />
                Pagar
              </Button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Seletor de Cartão */}
      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Faturas de Cartão
          </CardTitle>
          <CardDescription>Selecione um cartão para ver suas faturas</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCartoes ? (
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[104px] w-[200px] flex-shrink-0 rounded-lg" />
              ))}
            </div>
          ) : errorCartoes ? (
            <FinanceErrorState onRetry={() => void refetchCartoes()} />
          ) : cartoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado. Cadastre um cartão na aba Contas.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {cartoes.map((cartao) => (
                <button
                  key={cartao.id}
                  onClick={() => setSelectedCartaoId(cartao.id)}
                  className={cn(
                    "flex-shrink-0 p-4 rounded-lg border-2 transition-all text-left min-w-[200px]",
                    selectedCartaoId === cartao.id ? "border-brand bg-brand/5" : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cartao.cor || "hsl(var(--chart-neutral))" }}
                    />
                    <span className="font-medium text-sm">{cartao.nome}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Fecha: dia {cartao.dia_fechamento} | Vence: dia {cartao.dia_vencimento}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Usado: {formatBRL(Number(cartao.usado ?? 0))} / {formatBRL(Number(cartao.limite ?? 0))}
                  </div>
                  {(() => {
                    const usado = Number(cartao.usado ?? 0);
                    const limite = Number(cartao.limite ?? 0);
                    const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
                    return (
                      <div
                        className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={Math.round(pct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Uso do limite do cartão"
                      >
                        <div
                          className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : "bg-brand")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    );
                  })()}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Faturas */}
      {selectedCartao && (
        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Faturas — {selectedCartao.nome}
            </CardTitle>
            <CardDescription>
              Fechamento dia {selectedCartao.dia_fechamento} | Vencimento dia {selectedCartao.dia_vencimento}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={faturaColumns}
              data={toDataSourceResult<Fatura>({ data: faturas, isLoading: loadingFaturas, error: faturasError })}
              rowKey={(f) => f.id}
              onRowClick={handleOpenDetail}
              defaultSortKey="referencia"
              defaultSortDir="desc"
              emptyMessage="Nenhuma fatura encontrada para este cartão."
              errorTitle="Não foi possível carregar as faturas"
              minWidth="720px"
            />
          </CardContent>
        </Card>
      )}

      {/* Modal de Detalhes da Fatura */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Fatura {selectedFatura && `${MESES[selectedFatura.mes_referencia - 1]} ${selectedFatura.ano_referencia}`}
            </DialogTitle>
            <DialogDescription>
              {selectedFatura && `${selectedFatura.cartao_nome} — ${selectedFatura.qtd_despesas} despesa(s)`}
            </DialogDescription>
          </DialogHeader>
          {selectedFatura && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedFatura.status, selectedFatura.data_vencimento)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-sm font-bold mt-1">
                    R$ {selectedFatura.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="text-sm font-medium mt-1">
                    {format(new Date(selectedFatura.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Ciclo</p>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedFatura.data_inicio + "T00:00:00"), "dd/MM")} a{" "}
                    {format(new Date(selectedFatura.data_fim + "T00:00:00"), "dd/MM")}
                  </p>
                </div>
              </div>

              {selectedFatura.data_pagamento && (
                <div className="p-3 bg-positive/10 rounded-lg text-sm text-positive-strong">
                  Paga em {format(new Date(selectedFatura.data_pagamento + "T00:00:00"), "dd/MM/yyyy")}
                  {selectedFatura.conta_pagamento_nome && ` via ${selectedFatura.conta_pagamento_nome}`}
                </div>
              )}

              <Separator />

              {/* Lista de Despesas */}
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
                            <span>{format(new Date(d.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}</span>
                            {d.categorias_financeiras?.nome && (
                              <span className="text-muted-foreground">| {d.categorias_financeiras.nome}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            R$ {d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
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
              {selectedFatura.status !== "Paga" &&
                selectedFatura.status !== "Aberta" &&
                selectedFatura.valor_total > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Valor restante</p>
                        <p className="text-lg font-bold">
                          R${" "}
                          {(selectedFatura.valor_total - selectedFatura.valor_pago).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <Button
                        className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                        onClick={() => handleOpenPagamento(selectedFatura)}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Pagar Fatura
                      </Button>
                    </div>
                  </>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento */}
      <Dialog open={isPagamentoOpen} onOpenChange={setIsPagamentoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Fatura</DialogTitle>
            <DialogDescription>
              {selectedFatura &&
                `${selectedFatura.cartao_nome} — ${MESES[selectedFatura.mes_referencia - 1]} ${selectedFatura.ano_referencia}`}
            </DialogDescription>
          </DialogHeader>
          {selectedFatura && (
            <div className="space-y-4 mt-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor total da fatura</span>
                  <span className="font-bold">
                    R$ {selectedFatura.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {selectedFatura.valor_pago > 0 && (
                  <>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Já pago</span>
                      <span className="text-positive-strong">
                        - R$ {selectedFatura.valor_pago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Restante</span>
                      <span>
                        R${" "}
                        {(selectedFatura.valor_total - selectedFatura.valor_pago).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Conta Bancária para Pagamento</Label>
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
                <Label>Valor do Pagamento (R$)</Label>
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
                className="w-full rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                onClick={handlePagar}
                disabled={pagarMutation.isPending || !contaPagamentoId}
              >
                {pagarMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
