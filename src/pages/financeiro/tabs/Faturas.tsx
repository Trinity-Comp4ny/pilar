import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Receipt, Calendar, DollarSign, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safeError";
import { format } from "date-fns";

interface Cartao {
  id: string;
  nome: string;
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string | null;
  limite: number;
  usado: number;
  disponivel: number;
  conta_pagamento_id: string | null;
}

interface Fatura {
  id: string;
  cartao_id: string;
  cartao_nome: string;
  cartao_cor: string | null;
  mes_referencia: number;
  ano_referencia: number;
  data_inicio: string;
  data_fim: string;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
  conta_pagamento_id: string | null;
  conta_pagamento_nome: string | null;
  valor_total: number;
  valor_pago: number;
  qtd_despesas: number;
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  categoria_id: string | null;
  categorias_financeiras: { nome: string } | null;
}

interface Conta {
  id: string;
  nome: string;
}

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

  if (status === "Paga") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paga</Badge>;
  if (isOverdue) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Vencida</Badge>;
  if (status === "Parcial") return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Parcial</Badge>;
  if (status === "Fechada") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Fechada</Badge>;
  return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Aberta</Badge>;
}

export default function Faturas() {
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [selectedCartaoId, setSelectedCartaoId] = useState<string>("");
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(false);

  // Detail dialog
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [despesasFatura, setDespesasFatura] = useState<Despesa[]>([]);

  // Payment dialog
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [contaPagamentoId, setContaPagamentoId] = useState("");
  const [valorPagamento, setValorPagamento] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const { toast } = useToast();

  const fetchCartoes = useCallback(async () => {
    const { data } = await supabase.from("view_cartao_resumo").select("*");
    if (data) {
      setCartoes(data as Cartao[]);
      if (data.length > 0 && !selectedCartaoId) {
        setSelectedCartaoId(data[0].id);
      }
    }
  }, [selectedCartaoId]);

  const fetchContas = useCallback(async () => {
    const { data } = await supabase.from("contas").select("id, nome");
    if (data) setContas(data);
  }, []);

  const gerarFaturasCartao = useCallback(async (cartaoId: string) => {
    // Gerar faturas para os últimos 3 meses e o mês atual
    const now = new Date();
    for (let i = -2; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      try {
        await supabase.rpc("gerar_fatura", {
          p_cartao_id: cartaoId,
          p_mes: d.getMonth() + 1,
          p_ano: d.getFullYear(),
        });
      } catch {
        // Ignora erros silenciosamente (pode não ter despesas)
      }
    }
  }, []);

  const fetchFaturas = useCallback(
    async (cartaoId: string) => {
      setLoading(true);
      try {
        // Gerar faturas pendentes
        await gerarFaturasCartao(cartaoId);

        const { data } = await supabase
          .from("view_fatura_resumo")
          .select("*")
          .eq("cartao_id", cartaoId)
          .order("ano_referencia", { ascending: false })
          .order("mes_referencia", { ascending: false });

        if (data) {
          // Determinar status real baseado na data
          const today = new Date();
          setFaturas(
            data
              .filter((f) => f.valor_total > 0 || f.status !== "Aberta")
              .map((f) => {
                let status = f.status;
                if (status === "Aberta" && new Date(f.data_fim) < today) {
                  status = "Fechada";
                }
                return { ...f, status };
              })
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [gerarFaturasCartao]
  );

  const fetchDespesasFatura = async (faturaId: string) => {
    const { data } = await supabase
      .from("despesas")
      .select("id, descricao, valor, data_vencimento, status, categoria_id, categorias_financeiras(nome)")
      .eq("fatura_id", faturaId)
      .not("cartao_id", "is", null)
      .order("data_vencimento", { ascending: true });

    if (data) setDespesasFatura(data as Despesa[]);
  };

  useEffect(() => {
    fetchCartoes();
    fetchContas();
  }, [fetchCartoes, fetchContas]);

  useEffect(() => {
    if (selectedCartaoId) {
      fetchFaturas(selectedCartaoId);
    }
  }, [selectedCartaoId, fetchFaturas]);

  const handleOpenDetail = async (fatura: Fatura) => {
    setSelectedFatura(fatura);
    setIsDetailOpen(true);
    await fetchDespesasFatura(fatura.id);
  };

  const handleOpenPagamento = (fatura: Fatura) => {
    setSelectedFatura(fatura);
    const cartao = cartoes.find((c) => c.id === fatura.cartao_id);
    setContaPagamentoId(cartao?.conta_pagamento_id || "");
    const restante = fatura.valor_total - fatura.valor_pago;
    setValorPagamento(restante.toFixed(2));
    setIsPagamentoOpen(true);
  };

  const handlePagar = async () => {
    if (!selectedFatura || !contaPagamentoId) {
      toast({ title: "Selecione a conta bancária", variant: "destructive" });
      return;
    }

    setIsPaying(true);
    try {
      const { error } = await supabase.rpc("pagar_fatura", {
        p_fatura_id: selectedFatura.id,
        p_conta_id: contaPagamentoId,
        p_valor_pago: parseFloat(valorPagamento),
        p_data_pagamento: format(new Date(), "yyyy-MM-dd"),
      });

      if (error) throw error;

      toast({ title: "Fatura paga com sucesso!" });
      setIsPagamentoOpen(false);
      setIsDetailOpen(false);
      fetchFaturas(selectedCartaoId);
      fetchCartoes();
    } catch (err: unknown) {
      toast({
        title: "Erro ao pagar fatura",
        description: getSafeErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsPaying(false);
    }
  };

  const selectedCartao = cartoes.find((c) => c.id === selectedCartaoId);

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Seletor de Cartão */}
      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Faturas de Cartão de Crédito
          </CardTitle>
          <CardDescription>Selecione um cartão para ver suas faturas</CardDescription>
        </CardHeader>
        <CardContent>
          {cartoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado. Cadastre um cartão na aba Contas.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {cartoes.map((cartao) => (
                <button
                  key={cartao.id}
                  onClick={() => setSelectedCartaoId(cartao.id)}
                  className={cn(
                    "flex-shrink-0 p-4 rounded-lg border-2 transition-all text-left min-w-[200px]",
                    selectedCartaoId === cartao.id
                      ? "border-accent-orange bg-accent-orange/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cartao.cor || "#888" }} />
                    <span className="font-medium text-sm">{cartao.nome}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Fecha: dia {cartao.dia_fechamento} | Vence: dia {cartao.dia_vencimento}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Usado: R$ {cartao.usado?.toLocaleString("pt-BR")} / R$ {cartao.limite?.toLocaleString("pt-BR")}
                  </div>
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
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Carregando faturas...</p>
            ) : faturas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma fatura encontrada para este cartão.</p>
            ) : (
              <div className="space-y-3">
                {faturas.map((fatura) => {
                  const restante = fatura.valor_total - fatura.valor_pago;
                  const isPagavel = fatura.status !== "Paga" && fatura.status !== "Aberta" && fatura.valor_total > 0;

                  return (
                    <div
                      key={fatura.id}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(fatura)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-medium text-sm">
                              {MESES[fatura.mes_referencia - 1]} {fatura.ano_referencia}
                            </h4>
                            {getStatusBadge(fatura.status, fatura.data_vencimento)}
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(fatura.data_inicio + "T00:00:00"), "dd/MM")} a{" "}
                              {format(new Date(fatura.data_fim + "T00:00:00"), "dd/MM")}
                            </span>
                            <span>Vence: {format(new Date(fatura.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}</span>
                            <span>{fatura.qtd_despesas} despesa(s)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              R$ {fatura.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                            {fatura.valor_pago > 0 && fatura.status !== "Paga" && (
                              <p className="text-xs text-gray-500">
                                Restante: R$ {restante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                          {isPagavel && (
                            <Button
                              size="sm"
                              className="bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPagamento(fatura);
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  <p className="text-xs text-gray-500">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedFatura.status, selectedFatura.data_vencimento)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Valor Total</p>
                  <p className="text-sm font-bold mt-1">
                    R$ {selectedFatura.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Vencimento</p>
                  <p className="text-sm font-medium mt-1">
                    {format(new Date(selectedFatura.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Ciclo</p>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedFatura.data_inicio + "T00:00:00"), "dd/MM")} a{" "}
                    {format(new Date(selectedFatura.data_fim + "T00:00:00"), "dd/MM")}
                  </p>
                </div>
              </div>

              {selectedFatura.data_pagamento && (
                <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800">
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
                          <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                            <span>{format(new Date(d.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}</span>
                            {d.categorias_financeiras?.nome && (
                              <span className="text-gray-400">| {d.categorias_financeiras.nome}</span>
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
                        <p className="text-sm text-gray-500">Valor restante</p>
                        <p className="text-lg font-bold">
                          R${" "}
                          {(selectedFatura.valor_total - selectedFatura.valor_pago).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <Button
                        className="bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full"
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
                  <span className="text-gray-500">Valor total da fatura</span>
                  <span className="font-bold">
                    R$ {selectedFatura.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {selectedFatura.valor_pago > 0 && (
                  <>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Já pago</span>
                      <span className="text-green-600">
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
                <p className="text-xs text-gray-500">
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
                className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full"
                onClick={handlePagar}
                disabled={isPaying || !contaPagamentoId}
              >
                {isPaying ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
