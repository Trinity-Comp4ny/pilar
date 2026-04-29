import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { CreditCard, Wallet, Plus, Settings, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrencyInput, formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface ContaItem {
  id: string;
  nome: string;
  banco: string;
  cor: string | null;
  empresa_id: string;
  saldo_inicial: number;
  saldo_atual: number;
  total_entradas: number;
  total_saidas: number;
}

interface CartaoItem {
  id: string;
  nome: string;
  dia_fechamento: number;
  dia_vencimento: number;
  limite: number;
  usado: number;
  disponivel: number;
  conta_pagamento_id: string | null;
}

export default function Configuracoes() {
  const [cartoes, setCartoes] = useState<CartaoItem[]>([]);
  const [contas, setContas] = useState<ContaItem[]>([]);

  const [isCartaoDetailOpen, setIsCartaoDetailOpen] = useState(false);
  const [isContaDetailOpen, setIsContaDetailOpen] = useState(false);
  const [isNewCartaoOpen, setIsNewCartaoOpen] = useState(false);
  const [isNewContaOpen, setIsNewContaOpen] = useState(false);

  const [selectedCartao, setSelectedCartao] = useState<CartaoItem | null>(null);
  const [selectedConta, setSelectedConta] = useState<ContaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "conta" | "cartao"; id: string; nome: string } | null>(null);
  const { canEdit } = useFeatureAccess("financeiro");

  // Form States
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [limite, setLimite] = useState("");
  const [contaPagamentoId, setContaPagamentoId] = useState("");

  useEffect(() => {
    fetchContas();
    fetchCartoes();
  }, []);

  const fetchContas = async () => {
    const { data } = await supabase.from("view_financas_resumo").select("*");
    if (data)
      setContas(
        data.map((c) => ({
          id: c.conta_id,
          nome: c.conta_nome,
          banco: c.banco,
          cor: c.cor,
          empresa_id: c.empresa_id,
          saldo_inicial: c.saldo_inicial,
          saldo_atual: c.saldo_atual,
          total_entradas: c.total_entradas,
          total_saidas: c.total_saidas,
        })) as ContaItem[]
      );
  };

  const fetchCartoes = async () => {
    const { data } = await supabase.from("view_cartao_resumo").select("*");
    if (data) setCartoes(data as CartaoItem[]);
  };

  const handleSaveConta = async () => {
    if (!nome || !banco || !saldoInicial) {
      toast.error("Campos obrigatórios", { description: "Preencha nome, banco e saldo inicial" });
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Erro", { description: "Usuário não autenticado" });
        return;
      }

      const empresaIdResult = await supabase.rpc("get_user_empresa_id");
      const empresaId = empresaIdResult.data;

      if (!empresaId) {
        toast.error("Erro", { description: "Empresa não encontrada" });
        return;
      }

      // saldo_atual não é definido aqui — é calculado pela view_financas_resumo
      const payload = {
        empresa_id: empresaId,
        nome,
        banco,
        saldo_inicial: parseCurrencyString(saldoInicial),
        cor: "hsl(var(--chart-neutral))",
      };

      if (selectedConta) {
        const { error } = await supabase
          .from("contas")
          .update({
            nome,
            banco,
            saldo_inicial: parseCurrencyString(saldoInicial),
          })
          .eq("id", selectedConta.id);

        if (error) {
          toast.error("Erro ao atualizar");
          return;
        }

        toast.success("Conta atualizada");
        fetchContas();
        setIsNewContaOpen(false);
        setIsContaDetailOpen(false);
      } else {
        const { error } = await supabase.from("contas").insert(payload);

        if (error) {
          toast.error("Erro ao criar conta");
          return;
        }

        toast.success("Conta criada");
        fetchContas();
        setIsNewContaOpen(false);
      }
      resetForm();
    } catch (err: unknown) {
      toast.error("Erro");
    }
  };

  const handleSaveCartao = async () => {
    if (!nome || !diaFechamento || !diaVencimento || !limite) {
      toast.error("Campos obrigatórios", { description: "Preencha todos os campos do cartão" });
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Erro", { description: "Usuário não autenticado" });
        return;
      }

      const empresaIdResult = await supabase.rpc("get_user_empresa_id");
      const empresaId = empresaIdResult.data;

      if (!empresaId) {
        toast.error("Erro", { description: "Empresa não encontrada" });
        return;
      }

      const payload = {
        empresa_id: empresaId,
        nome,
        dia_fechamento: parseInt(diaFechamento),
        dia_vencimento: parseInt(diaVencimento),
        limite: parseCurrencyString(limite),
        usado: 0,
        conta_pagamento_id: contaPagamentoId || null,
      };

      if (selectedCartao) {
        const { error } = await supabase
          .from("cartoes_credito")
          .update({
            nome,
            dia_fechamento: parseInt(diaFechamento),
            dia_vencimento: parseInt(diaVencimento),
            limite: parseCurrencyString(limite),
            conta_pagamento_id: contaPagamentoId || null,
          })
          .eq("id", selectedCartao.id);

        if (error) {
          toast.error("Erro ao atualizar");
          return;
        }

        toast.success("Cartão atualizado");
        fetchCartoes();
        setIsNewCartaoOpen(false);
        setIsCartaoDetailOpen(false);
      } else {
        const { error } = await supabase.from("cartoes_credito").insert(payload as never);

        if (error) {
          toast.error("Erro ao criar cartão");
          return;
        }

        toast.success("Cartão criado");
        fetchCartoes();
        setIsNewCartaoOpen(false);
      }
      resetForm();
    } catch (err: unknown) {
      toast.error("Erro");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    setDeleteTarget(null);

    if (type === "conta") {
      const { count: receitasCount } = await supabase
        .from("receitas")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", id)
        .is("deleted_at", null);
      const { count: despesasCount } = await supabase
        .from("despesas")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", id)
        .is("deleted_at", null);
      const total = (receitasCount ?? 0) + (despesasCount ?? 0);
      if (total > 0) {
        toast.error("Conta com movimentações", {
          description: `Existem ${total} lançamento(s) vinculados. Reatribua-os antes de excluir.`,
        });
        return;
      }
      const { error } = await supabase.from("contas").delete().eq("id", id);
      if (!error) {
        toast.success("Conta excluída");
        fetchContas();
        setIsContaDetailOpen(false);
      }
    } else {
      const { count: faturasCount } = await supabase
        .from("faturas")
        .select("id", { count: "exact", head: true })
        .eq("cartao_id", id);
      if ((faturasCount ?? 0) > 0) {
        toast.error("Cartão com faturas", {
          description: `Existem ${faturasCount} fatura(s) vinculada(s). Quite-as antes de excluir o cartão.`,
        });
        return;
      }
      const { error } = await supabase.from("cartoes_credito").delete().eq("id", id);
      if (!error) {
        toast.success("Cartão excluído");
        fetchCartoes();
        setIsCartaoDetailOpen(false);
      }
    }
  };

  const resetForm = () => {
    setNome("");
    setBanco("");
    setSaldoInicial("");
    setDiaFechamento("");
    setDiaVencimento("");
    setLimite("");
    setContaPagamentoId("");
    setSelectedConta(null);
    setSelectedCartao(null);
  };

  const openEditConta = (conta: ContaItem) => {
    setSelectedConta(conta);
    setNome(conta.nome);
    setBanco(conta.banco);
    setSaldoInicial(formatValorToInput(conta.saldo_inicial ?? 0));
    setIsNewContaOpen(true);
  };

  const openEditCartao = (cartao: CartaoItem) => {
    setSelectedCartao(cartao);
    setNome(cartao.nome);
    setDiaFechamento(cartao.dia_fechamento.toString());
    setDiaVencimento(cartao.dia_vencimento.toString());
    setLimite(formatValorToInput(cartao.limite ?? 0));
    setContaPagamentoId(cartao.conta_pagamento_id || "");
    setIsNewCartaoOpen(true);
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Resumo Financeiro Geral */}
      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Resumo Financeiro Consolidado
          </CardTitle>
          <CardDescription>Visão geral de todas as contas e cartões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 font-medium mb-1">Total em Contas</p>
              <p className="text-2xl font-bold text-blue-900">
                R$ {contas.reduce((acc, c) => acc + (c.saldo_atual || 0), 0).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-700 font-medium mb-1">Total Entradas</p>
              <p className="text-2xl font-bold text-green-900">
                R$ {contas.reduce((acc, c) => acc + (c.total_entradas || 0), 0).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-red-700 font-medium mb-1">Total Saídas</p>
              <p className="text-2xl font-bold text-red-900">
                R$ {contas.reduce((acc, c) => acc + (c.total_saidas || 0), 0).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="p-4 bg-accent-orange/10 rounded-lg border border-accent-orange/20">
              <p className="text-xs text-accent-orange font-medium mb-1">Usado em Cartões</p>
              <p className="text-2xl font-bold text-accent-orange">
                R$ {cartoes.reduce((acc, c) => acc + (c.usado || 0), 0).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Contas Bancárias */}
        <Card className="vrz-card w-full">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Contas Bancárias
                </CardTitle>
                <CardDescription>Gerenciar saldos e movimentações</CardDescription>
              </div>
              <Dialog
                open={isNewContaOpen}
                onOpenChange={(open) => {
                  setIsNewContaOpen(open);
                  if (!open) resetForm();
                }}
              >
                {canEdit && (
                  <DialogTrigger asChild>
                    <Button
                      className="bg-accent-orange hover:bg-accent-orange/90 text-ink rounded-full"
                      size="sm"
                      onClick={() => {
                        resetForm();
                        setIsNewContaOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Conta
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{selectedConta ? "Editar Conta" : "Adicionar Conta Bancária"}</DialogTitle>
                    <DialogDescription>Configure sua conta para acompanhamento automático</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome da Conta</Label>
                      <Input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Ex: Nubank Conta Corrente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Banco</Label>
                      <Input
                        value={banco}
                        onChange={(e) => setBanco(e.target.value)}
                        placeholder="Ex: Nubank, Itaú, Bradesco..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Saldo Inicial (R$)</Label>
                      <Input
                        type="text"
                        value={saldoInicial}
                        onChange={(e) => setSaldoInicial(formatCurrencyInput(e.target.value))}
                        placeholder="R$ 5.000,00"
                      />
                    </div>
                    <Button
                      className="w-full bg-accent-orange hover:bg-accent-orange/90 text-ink rounded-full"
                      onClick={handleSaveConta}
                    >
                      {selectedConta ? "Atualizar Conta" : "Salvar Conta"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contas.map((conta, idx) => {
                const variacao = (conta.saldo_atual || 0) - (conta.saldo_inicial || 0);
                const percentVariacao = conta.saldo_inicial ? (variacao / conta.saldo_inicial) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedConta(conta);
                      setIsContaDetailOpen(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: conta.cor || "hsl(var(--chart-neutral))" }}
                        >
                          {conta.banco ? conta.banco.substring(0, 2).toUpperCase() : "??"}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{conta.nome}</h4>
                          <p className="text-xs text-gray-600">{conta.banco}</p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditConta(conta)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={() => setDeleteTarget({ type: "conta", id: conta.id, nome: conta.nome })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Saldo Atual</span>
                        <span className="text-lg font-bold text-gray-900">
                          R$ {conta.saldo_atual?.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">
                          Saldo Inicial: R$ {conta.saldo_inicial?.toLocaleString("pt-BR")}
                        </span>
                        <span
                          className={cn(
                            "font-medium flex items-center gap-1",
                            variacao >= 0 ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {variacao >= 0 ? "+" : ""}
                          {percentVariacao.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cartões de Crédito */}
        <Card className="vrz-card w-full">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Cartões de Crédito
                </CardTitle>
                <CardDescription>Gerenciar datas de fechamento e vencimento</CardDescription>
              </div>
              <Dialog
                open={isNewCartaoOpen}
                onOpenChange={(open) => {
                  setIsNewCartaoOpen(open);
                  if (!open) resetForm();
                }}
              >
                {canEdit && (
                  <DialogTrigger asChild>
                    <Button
                      className="bg-accent-orange hover:bg-accent-orange/90 text-ink rounded-full"
                      size="sm"
                      onClick={() => {
                        resetForm();
                        setIsNewCartaoOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Cartão
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{selectedCartao ? "Editar Cartão" : "Adicionar Cartão de Crédito"}</DialogTitle>
                    <DialogDescription>
                      Configure as datas do seu cartão para melhor controle financeiro
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome do Cartão</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank Platinum" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dia de Fechamento</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={diaFechamento}
                          onChange={(e) => setDiaFechamento(e.target.value)}
                          placeholder="10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Dia de Vencimento</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={diaVencimento}
                          onChange={(e) => setDiaVencimento(e.target.value)}
                          placeholder="20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Limite (R$)</Label>
                      <Input
                        type="text"
                        value={limite}
                        onChange={(e) => setLimite(formatCurrencyInput(e.target.value))}
                        placeholder="R$ 10.000,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Conta para Pagamento de Faturas</Label>
                      <Select value={contaPagamentoId} onValueChange={setContaPagamentoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhuma</SelectItem>
                          {contas.map((conta) => (
                            <SelectItem key={conta.id} value={conta.id}>
                              {conta.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Conta padrão usada ao pagar faturas deste cartão</p>
                    </div>
                    <Button
                      className="w-full bg-accent-orange hover:bg-accent-orange/90 text-ink rounded-full"
                      onClick={handleSaveCartao}
                    >
                      {selectedCartao ? "Atualizar Cartão" : "Salvar Cartão"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cartoes.map((cartao, idx) => {
                const percentUsed = (cartao.usado / cartao.limite) * 100;
                return (
                  <div
                    key={idx}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedCartao(cartao);
                      setIsCartaoDetailOpen(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-sm">{cartao.nome}</h4>
                        <div className="flex gap-4 mt-1 text-xs text-gray-600">
                          <span>Fecha: dia {cartao.dia_fechamento}</span>
                          <span>Vence: dia {cartao.dia_vencimento}</span>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditCartao(cartao)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={() => setDeleteTarget({ type: "cartao", id: cartao.id, nome: cartao.nome })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">
                          Utilizado: R$ {cartao.usado?.toLocaleString("pt-BR") || "0,00"}
                        </span>
                        <span className="text-gray-600">Limite: R$ {cartao.limite.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            percentUsed > 80 ? "bg-red-500" : percentUsed > 50 ? "bg-yellow-500" : "bg-green-500"
                          )}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{percentUsed.toFixed(1)}% utilizado</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes do Cartão */}
      <Dialog open={isCartaoDetailOpen} onOpenChange={setIsCartaoDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Cartão</DialogTitle>
            <DialogDescription>Informações do cartão selecionado</DialogDescription>
          </DialogHeader>
          {selectedCartao && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome do Cartão</Label>
                  <p className="text-sm font-medium">{selectedCartao.nome}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fechamento</Label>
                  <p className="text-sm">Dia {selectedCartao.dia_fechamento}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vencimento</Label>
                  <p className="text-sm">Dia {selectedCartao.dia_vencimento}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Limite Total</Label>
                  <p className="text-sm">R$ {selectedCartao.limite.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Utilizado</Label>
                  <p className="text-sm text-accent-orange font-medium">
                    R$ {selectedCartao.usado?.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="col-span-2 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Disponível</Label>
                  <p className="text-lg font-bold text-green-600">
                    R$ {selectedCartao.disponivel?.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 border-t pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsCartaoDetailOpen(false)}>
                  Fechar
                </Button>
                {canEdit && (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => openEditCartao(selectedCartao)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() =>
                        setDeleteTarget({ type: "cartao", id: selectedCartao.id, nome: selectedCartao.nome })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Conta */}
      <Dialog open={isContaDetailOpen} onOpenChange={setIsContaDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Conta</DialogTitle>
            <DialogDescription>Informações da conta selecionada</DialogDescription>
          </DialogHeader>
          {selectedConta && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome da Conta</Label>
                  <p className="text-sm font-medium">{selectedConta.nome}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Banco</Label>
                  <p className="text-sm">{selectedConta.banco}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Saldo Inicial</Label>
                  <p className="text-sm">R$ {selectedConta.saldo_inicial?.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Entradas (Recebidas)</Label>
                  <p className="text-sm font-medium text-green-600">
                    + R$ {selectedConta.total_entradas?.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Saídas (Pagas)</Label>
                  <p className="text-sm font-medium text-red-600">
                    - R$ {selectedConta.total_saidas?.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="col-span-2 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Saldo Atual</Label>
                  <p className="text-lg font-bold">R$ {selectedConta.saldo_atual?.toLocaleString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 border-t pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsContaDetailOpen(false)}>
                  Fechar
                </Button>
                {canEdit && (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => openEditConta(selectedConta)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setDeleteTarget({ type: "conta", id: selectedConta.id, nome: selectedConta.nome })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.type === "conta" ? "conta" : "cartão"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme a exclusão de <strong>{deleteTarget?.nome}</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
