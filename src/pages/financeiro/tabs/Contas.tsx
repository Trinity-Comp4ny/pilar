import { Card, CardContent } from "@/components/ui/card";
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
import { CreditCard, Wallet, Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { detectTipoChavePix, TIPO_CHAVE_PIX_LABEL, type TipoChavePix } from "@/lib/pixUtils";
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
  chave_pix?: string | null;
  tipo_chave_pix?: TipoChavePix | null;
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
  tipo: string;
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

  const [isNewCartaoOpen, setIsNewCartaoOpen] = useState(false);
  const [isNewContaOpen, setIsNewContaOpen] = useState(false);

  const [selectedCartao, setSelectedCartao] = useState<CartaoItem | null>(null);
  const [selectedConta, setSelectedConta] = useState<ContaItem | null>(null);

  const [panelConta, setPanelConta] = useState<ContaItem | null>(null);
  const [panelCartao, setPanelCartao] = useState<CartaoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "conta" | "cartao"; id: string; nome: string } | null>(null);
  const { canEdit } = useFeatureAccess("financeiro");

  // Form States
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [contaErrors, setContaErrors] = useState<Record<string, boolean>>({});
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [limite, setLimite] = useState("");
  const [contaPagamentoId, setContaPagamentoId] = useState("");
  const [tipoCartao, setTipoCartao] = useState<"credito" | "debito">("credito");

  useEffect(() => {
    fetchContas();
    fetchCartoes();
  }, []);

  const fetchContas = async () => {
    const { data: viewData } = await supabase.from("view_financas_resumo").select("*");
    if (!viewData) return;

    const ids = viewData.map((c) => c.conta_id).filter(Boolean) as string[];
    const { data: pixData = [] } = ids.length
      ? await supabase.from("contas").select("id, chave_pix, tipo_chave_pix").in("id", ids)
      : { data: [] };

    const pixMap = Object.fromEntries((pixData ?? []).map((p) => [p.id, p]));

    setContas(
      viewData.map((c) => ({
        id: c.conta_id,
        nome: c.conta_nome,
        banco: c.banco,
        cor: c.cor,
        empresa_id: c.empresa_id,
        saldo_inicial: c.saldo_inicial,
        saldo_atual: c.saldo_atual,
        total_entradas: c.total_entradas,
        total_saidas: c.total_saidas,
        chave_pix: c.conta_id ? (pixMap[c.conta_id]?.chave_pix ?? null) : null,
        tipo_chave_pix: c.conta_id ? ((pixMap[c.conta_id]?.tipo_chave_pix as TipoChavePix) ?? null) : null,
      })) as ContaItem[]
    );
  };

  const fetchCartoes = async () => {
    const { data } = await supabase.from("view_cartao_resumo").select("*");
    if (data) setCartoes(data as CartaoItem[]);
  };

  const handleSaveConta = async () => {
    const errors = { nome: !nome, banco: !banco, saldoInicial: !saldoInicial };
    setContaErrors(errors);
    if (errors.nome || errors.banco || errors.saldoInicial) {
      toast.error("Campos obrigatórios", { description: "Preencha todos os campos marcados com *" });
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

      const pixTipo = chavePix ? (detectTipoChavePix(chavePix) ?? null) : null;

      // saldo_atual não é definido aqui — é calculado pela view_financas_resumo
      const payload = {
        empresa_id: empresaId,
        nome,
        banco,
        saldo_inicial: parseCurrencyString(saldoInicial),
        cor: "hsl(var(--chart-neutral))",
        chave_pix: chavePix || null,
        tipo_chave_pix: pixTipo,
      };

      if (selectedConta) {
        const { error } = await supabase
          .from("contas")
          .update({
            nome,
            banco,
            saldo_inicial: parseCurrencyString(saldoInicial),
            chave_pix: chavePix || null,
            tipo_chave_pix: pixTipo,
          })
          .eq("id", selectedConta.id);

        if (error) {
          toast.error("Erro ao atualizar conta", { description: error.message });
          return;
        }

        toast.success("Conta atualizada");
        fetchContas();
        setIsNewContaOpen(false);
      } else {
        const { error } = await supabase.from("contas").insert(payload);

        if (error) {
          toast.error("Erro ao criar conta", { description: error.message });
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
        tipo: tipoCartao,
        dia_fechamento: parseInt(diaFechamento),
        dia_vencimento: parseInt(diaVencimento),
        limite: parseCurrencyString(limite),
        usado: 0,
        conta_pagamento_id: contaPagamentoId === "__none__" ? null : contaPagamentoId || null,
      };

      if (selectedCartao) {
        const { error } = await supabase
          .from("cartoes")
          .update({
            nome,
            tipo: tipoCartao,
            dia_fechamento: parseInt(diaFechamento),
            dia_vencimento: parseInt(diaVencimento),
            limite: parseCurrencyString(limite),
            conta_pagamento_id: contaPagamentoId === "__none__" ? null : contaPagamentoId || null,
          })
          .eq("id", selectedCartao.id);

        if (error) {
          toast.error("Erro ao atualizar");
          return;
        }

        toast.success("Cartão atualizado");
        fetchCartoes();
        setIsNewCartaoOpen(false);
      } else {
        const { error } = await supabase.from("cartoes").insert(payload as never);

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
        setPanelConta(null);
      } else {
        toast.error("Não foi possível excluir a conta. Tente novamente.");
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
      const { error } = await supabase.from("cartoes").delete().eq("id", id);
      if (!error) {
        toast.success("Cartão excluído");
        fetchCartoes();
        setPanelCartao(null);
      } else {
        toast.error("Não foi possível excluir o cartão. Tente novamente.");
      }
    }
  };

  const resetForm = () => {
    setNome("");
    setBanco("");
    setSaldoInicial("");
    setChavePix("");
    setContaErrors({});
    setDiaFechamento("");
    setDiaVencimento("");
    setLimite("");
    setContaPagamentoId("");
    setTipoCartao("credito");
    setSelectedConta(null);
    setSelectedCartao(null);
  };

  const openEditConta = (conta: ContaItem) => {
    setSelectedConta(conta);
    setNome(conta.nome);
    setBanco(conta.banco);
    setChavePix(conta.chave_pix ?? "");
    setSaldoInicial(formatValorToInput(conta.saldo_inicial ?? 0));
    setIsNewContaOpen(true);
  };

  const openEditCartao = (cartao: CartaoItem) => {
    setSelectedCartao(cartao);
    setNome(cartao.nome);
    setDiaFechamento(cartao.dia_fechamento.toString());
    setDiaVencimento(cartao.dia_vencimento.toString());
    setLimite(formatValorToInput(cartao.limite ?? 0));
    setContaPagamentoId(cartao.conta_pagamento_id || "__none__");
    setTipoCartao((cartao.tipo as "credito" | "debito") ?? "credito");
    setIsNewCartaoOpen(true);
  };

  return (
    <>
      <Card className="vrz-card w-full">
        <CardContent className="p-0">
          <div className="flex min-h-[480px]">
            {/* Sidebar esquerda */}
            <div className="w-64 shrink-0 border-r flex flex-col">
              {/* Contas */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> Contas
                  </span>
                  {canEdit && (
                    <Dialog
                      open={isNewContaOpen}
                      onOpenChange={(open) => {
                        setIsNewContaOpen(open);
                        if (!open) resetForm();
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            resetForm();
                            setIsNewContaOpen(true);
                          }}
                          aria-label="Adicionar conta"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>{selectedConta ? "Editar Conta" : "Adicionar Conta Bancária"}</DialogTitle>
                          <DialogDescription>Configure sua conta para acompanhamento automático</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>
                              Nome da Conta <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={nome}
                              onChange={(e) => {
                                setNome(e.target.value);
                                setContaErrors((p) => ({ ...p, nome: false }));
                              }}
                              placeholder="Ex: Nubank Conta Corrente"
                              className={contaErrors.nome ? "border-destructive focus-visible:ring-destructive" : ""}
                            />
                            {contaErrors.nome && <p className="text-xs text-destructive">Campo obrigatório</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>
                              Banco <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={banco}
                              onChange={(e) => {
                                setBanco(e.target.value);
                                setContaErrors((p) => ({ ...p, banco: false }));
                              }}
                              placeholder="Ex: Nubank, Itaú, Bradesco..."
                              className={contaErrors.banco ? "border-destructive focus-visible:ring-destructive" : ""}
                            />
                            {contaErrors.banco && <p className="text-xs text-destructive">Campo obrigatório</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>
                              Saldo Inicial (R$) <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={saldoInicial}
                              onChange={(e) => {
                                setSaldoInicial(formatCurrencyInput(e.target.value));
                                setContaErrors((p) => ({ ...p, saldoInicial: false }));
                              }}
                              placeholder="R$ 5.000,00"
                              className={
                                contaErrors.saldoInicial ? "border-destructive focus-visible:ring-destructive" : ""
                              }
                            />
                            {contaErrors.saldoInicial && <p className="text-xs text-destructive">Campo obrigatório</p>}
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              Chave PIX
                              {chavePix && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                  {TIPO_CHAVE_PIX_LABEL[detectTipoChavePix(chavePix) as TipoChavePix] ??
                                    "Detectando..."}
                                </Badge>
                              )}
                            </Label>
                            <Input
                              value={chavePix}
                              onChange={(e) => setChavePix(e.target.value)}
                              placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                            />
                          </div>
                          <Button
                            className="w-full rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                            onClick={handleSaveConta}
                          >
                            {selectedConta ? "Atualizar Conta" : "Salvar Conta"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="space-y-0.5">
                  {contas.map((conta) => (
                    <button
                      key={conta.id}
                      onClick={() => {
                        setPanelConta(conta);
                        setPanelCartao(null);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5",
                        panelConta?.id === conta.id && !panelCartao
                          ? "bg-brand text-white font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <div
                        className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: conta.cor || "hsl(var(--chart-neutral))" }}
                      >
                        {conta.banco ? conta.banco.substring(0, 2).toUpperCase() : "??"}
                      </div>
                      <span className="text-sm font-medium truncate flex-1">{conta.nome}</span>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {(conta.saldo_atual / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k
                      </span>
                    </button>
                  ))}
                  {contas.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Nenhuma conta cadastrada</p>
                  )}
                </div>
              </div>

              {/* Cartões */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Cartões
                  </span>
                  {canEdit && (
                    <Dialog
                      open={isNewCartaoOpen}
                      onOpenChange={(open) => {
                        setIsNewCartaoOpen(open);
                        if (!open) resetForm();
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            resetForm();
                            setIsNewCartaoOpen(true);
                          }}
                          aria-label="Adicionar cartão"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>{selectedCartao ? "Editar Cartão" : "Adicionar Cartão"}</DialogTitle>
                          <DialogDescription>
                            Configure as datas do seu cartão para melhor controle financeiro
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Tipo de Cartão</Label>
                            <Select value={tipoCartao} onValueChange={(v) => setTipoCartao(v as "credito" | "debito")}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="credito">Crédito</SelectItem>
                                <SelectItem value="debito">Débito</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Nome do Cartão</Label>
                            <Input
                              value={nome}
                              onChange={(e) => setNome(e.target.value)}
                              placeholder="Ex: Nubank Platinum"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
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
                                <SelectItem value="__none__">Nenhuma</SelectItem>
                                {contas.map((conta) => (
                                  <SelectItem key={conta.id} value={conta.id}>
                                    {conta.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Conta padrão usada ao pagar faturas deste cartão
                            </p>
                          </div>
                          <Button
                            className="w-full rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                            onClick={handleSaveCartao}
                          >
                            {selectedCartao ? "Atualizar Cartão" : "Salvar Cartão"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="space-y-0.5">
                  {cartoes.map((cartao) => {
                    const pct = cartao.limite ? (cartao.usado / cartao.limite) * 100 : 0;
                    return (
                      <button
                        key={cartao.id}
                        onClick={() => {
                          setPanelCartao(cartao);
                          setPanelConta(null);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                          panelCartao?.id === cartao.id && !panelConta
                            ? "bg-brand text-white font-medium"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium truncate">{cartao.nome}</span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1">
                          <div
                            className={cn(
                              "h-1 rounded-full transition-all",
                              pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-positive"
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                  {cartoes.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Nenhum cartão cadastrado</p>
                  )}
                </div>
              </div>
            </div>

            {/* Painel de detalhes */}
            <div className="flex-1 p-6">
              {panelConta && !panelCartao ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: panelConta.cor || "hsl(var(--chart-neutral))" }}
                      >
                        {panelConta.banco ? panelConta.banco.substring(0, 2).toUpperCase() : "??"}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">{panelConta.nome}</h2>
                        <p className="text-sm text-muted-foreground">{panelConta.banco}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="h-9 rounded-full text-sm"
                          onClick={() => openEditConta(panelConta)}
                        >
                          <Pencil className="h-4 w-4 mr-1.5" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="h-9 rounded-full text-sm text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ type: "conta", id: panelConta.id, nome: panelConta.nome })}
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-5">
                    <p className="text-xs text-muted-foreground mb-1">Saldo Atual</p>
                    <p className="text-3xl font-bold">
                      R$ {panelConta.saldo_atual?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    {(() => {
                      const variacao = (panelConta.saldo_atual || 0) - (panelConta.saldo_inicial || 0);
                      const pct = panelConta.saldo_inicial ? (variacao / panelConta.saldo_inicial) * 100 : 0;
                      return (
                        <p
                          className={cn(
                            "text-sm mt-1 flex items-center gap-1",
                            variacao >= 0 ? "text-positive" : "text-red-600"
                          )}
                        >
                          {variacao >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {variacao >= 0 ? "+" : ""}
                          {pct.toFixed(1)}% em relação ao saldo inicial
                        </p>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Saldo Inicial</p>
                      <p className="text-sm font-semibold">
                        R$ {panelConta.saldo_inicial?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-positive/5 border border-positive/20">
                      <p className="text-xs text-positive mb-1">Entradas</p>
                      <p className="text-sm font-semibold text-positive">
                        + R$ {panelConta.total_entradas?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-xs text-red-600 mb-1">Saídas</p>
                      <p className="text-sm font-semibold text-red-700">
                        - R$ {panelConta.total_saidas?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {panelConta.chave_pix && (
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Chave PIX</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{panelConta.chave_pix}</p>
                        {panelConta.tipo_chave_pix && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {TIPO_CHAVE_PIX_LABEL[panelConta.tipo_chave_pix]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : panelCartao && !panelConta ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{panelCartao.nome}</h2>
                        <Badge variant="outline" className="text-xs">
                          {panelCartao.tipo === "debito" ? "Débito" : "Crédito"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Fecha dia {panelCartao.dia_fechamento} · Vence dia {panelCartao.dia_vencimento}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="h-9 rounded-full text-sm"
                          onClick={() => openEditCartao(panelCartao)}
                        >
                          <Pencil className="h-4 w-4 mr-1.5" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="h-9 rounded-full text-sm text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteTarget({ type: "cartao", id: panelCartao.id, nome: panelCartao.nome })
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-5">
                    <p className="text-xs text-muted-foreground mb-1">Disponível</p>
                    <p className="text-3xl font-bold text-positive">
                      R$ {panelCartao.disponivel?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Utilizado:{" "}
                        <span className="font-medium text-foreground">
                          R$ {panelCartao.usado?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Limite:{" "}
                        <span className="font-medium text-foreground">
                          R$ {panelCartao.limite?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </span>
                    </div>
                    {(() => {
                      const pct = panelCartao.limite ? (panelCartao.usado / panelCartao.limite) * 100 : 0;
                      return (
                        <>
                          <div className="w-full bg-muted rounded-full h-2.5">
                            <div
                              className={cn(
                                "h-2.5 rounded-full transition-all",
                                pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-positive"
                              )}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% utilizado</p>
                        </>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Fechamento</p>
                      <p className="text-sm font-semibold">Dia {panelCartao.dia_fechamento}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                      <p className="text-sm font-semibold">Dia {panelCartao.dia_vencimento}</p>
                    </div>
                  </div>

                  {panelCartao.conta_pagamento_id && (
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Conta para pagamento de faturas</p>
                      <p className="text-sm font-medium">
                        {contas.find((c) => c.id === panelCartao.conta_pagamento_id)?.nome ?? "—"}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Wallet className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Selecione uma conta ou cartão</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
              Deseja excluir <strong>{deleteTarget?.nome}</strong>? A conta será desativada e não aparecerá mais nos lançamentos.
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
    </>
  );
}
