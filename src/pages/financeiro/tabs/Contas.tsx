import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Wallet, Plus, Settings, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/maskUtils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safeError";

export default function Configuracoes() {
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);

  const [isCartaoDetailOpen, setIsCartaoDetailOpen] = useState(false);
  const [isContaDetailOpen, setIsContaDetailOpen] = useState(false);
  const [isNewCartaoOpen, setIsNewCartaoOpen] = useState(false);
  const [isNewContaOpen, setIsNewContaOpen] = useState(false);

  const [selectedCartao, setSelectedCartao] = useState<any>(null);
  const [selectedConta, setSelectedConta] = useState<any>(null);

  // Form States
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [limite, setLimite] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    fetchContas();
    fetchCartoes();
  }, []);

  const fetchContas = async () => {
    const { data } = await supabase.from('contas').select('*');
    if (data) setContas(data);
  };

  const fetchCartoes = async () => {
    const { data } = await supabase.from('cartoes_credito').select('*');
    if (data) setCartoes(data);
  };

  const handleSaveConta = async () => {
    if (!nome || !banco || !saldoInicial) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, banco e saldo inicial",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
        return;
      }

      const empresaIdResult = await supabase.rpc('get_user_empresa_id', {});
      const empresaId = empresaIdResult.data;

      if (!empresaId) {
        toast({ title: "Erro", description: "Empresa não encontrada", variant: "destructive" });
        return;
      }

      const payload = {
        user_id: user.id,
        empresa_id: empresaId,
        nome,
        banco,
        saldo_inicial: parseCurrencyString(saldoInicial),
        saldo_atual: parseCurrencyString(saldoInicial),
        cor: '#888888'
      };

      if (selectedConta) {
        const { error } = await supabase.from('contas').update({
          nome,
          banco,
          saldo_inicial: parseCurrencyString(saldoInicial)
        }).eq('id', selectedConta.id);

        if (error) {
          toast({
            title: "Erro ao atualizar",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({ title: "Conta atualizada" });
        fetchContas();
        setIsNewContaOpen(false);
        setIsContaDetailOpen(false);
      } else {
        const { error } = await supabase.from('contas').insert(payload);

        if (error) {
          toast({
            title: "Erro ao criar conta",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({ title: "Conta criada" });
        fetchContas();
        setIsNewContaOpen(false);
      }
      resetForm();
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: getSafeErrorMessage(err),
        variant: "destructive"
      });
    }
  };

  const handleSaveCartao = async () => {
    if (!nome || !diaFechamento || !diaVencimento || !limite) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos do cartão",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
        return;
      }

      const empresaIdResult = await supabase.rpc('get_user_empresa_id', {});
      const empresaId = empresaIdResult.data;

      if (!empresaId) {
        toast({ title: "Erro", description: "Empresa não encontrada", variant: "destructive" });
        return;
      }

      const payload = {
        user_id: user.id,
        empresa_id: empresaId,
        nome,
        dia_fechamento: parseInt(diaFechamento, 10),
        dia_vencimento: parseInt(diaVencimento, 10),
        limite: parseCurrencyString(limite),
        usado: 0
      };

      if (selectedCartao) {
        const { error } = await supabase.from('cartoes_credito').update({
          nome,
          dia_fechamento: parseInt(diaFechamento, 10),
          dia_vencimento: parseInt(diaVencimento, 10),
          limite: parseCurrencyString(limite)
        }).eq('id', selectedCartao.id);

        if (error) {
          toast({
            title: "Erro ao atualizar",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({ title: "Cartão atualizado" });
        fetchCartoes();
        setIsNewCartaoOpen(false);
        setIsCartaoDetailOpen(false);
      } else {
        const { error } = await supabase.from('cartoes_credito').insert(payload);

        if (error) {
          toast({
            title: "Erro ao criar cartão",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({ title: "Cartão criado" });
        fetchCartoes();
        setIsNewCartaoOpen(false);
      }
      resetForm();
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: getSafeErrorMessage(err),
        variant: "destructive"
      });
    }
  };

  const handleDeleteConta = async (id: string) => {
    const { error } = await supabase.from('contas').delete().eq('id', id);
    if (!error) {
      toast({ title: "Conta excluída" });
      fetchContas();
      setIsContaDetailOpen(false);
    }
  };

  const handleDeleteCartao = async (id: string) => {
    const { error } = await supabase.from('cartoes_credito').delete().eq('id', id);
    if (!error) {
      toast({ title: "Cartão excluído" });
      fetchCartoes();
      setIsCartaoDetailOpen(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setBanco("");
    setSaldoInicial("");
    setDiaFechamento("");
    setDiaVencimento("");
    setLimite("");
    setSelectedConta(null);
    setSelectedCartao(null);
  };

  const openEditConta = (conta: any) => {
    setSelectedConta(conta);
    setNome(conta.nome);
    setBanco(conta.banco);
    setSaldoInicial(formatCurrencyInput((conta.saldo_inicial * 100).toString()));
    setIsNewContaOpen(true);
  };

  const openEditCartao = (cartao: any) => {
    setSelectedCartao(cartao);
    setNome(cartao.nome);
    setDiaFechamento(cartao.dia_fechamento.toString());
    setDiaVencimento(cartao.dia_vencimento.toString());
    setLimite(formatCurrencyInput((cartao.limite * 100).toString()));
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
                R$ {contas.reduce((acc, c) => acc + (c.saldo_atual || 0), 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="p-4 bg-accent-orange/10 rounded-lg border border-accent-orange/20">
              <p className="text-xs text-accent-orange font-medium mb-1">Usado em Cartões</p>
              <p className="text-2xl font-bold text-accent-orange">
                R$ {cartoes.reduce((acc, c) => acc + (c.usado || 0), 0).toLocaleString('pt-BR')}
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
              <Dialog open={isNewContaOpen} onOpenChange={(open) => {
                setIsNewContaOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full" size="sm" onClick={() => {
                    resetForm();
                    setIsNewContaOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Conta
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{selectedConta ? 'Editar Conta' : 'Adicionar Conta Bancária'}</DialogTitle>
                    <DialogDescription>Configure sua conta para acompanhamento automático</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome da Conta</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank Conta Corrente" />
                    </div>
                    <div className="space-y-2">
                      <Label>Banco</Label>
                      <Select value={banco} onValueChange={setBanco}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o banco" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nubank">Nubank</SelectItem>
                          <SelectItem value="itau">Itaú</SelectItem>
                          <SelectItem value="bradesco">Bradesco</SelectItem>
                          <SelectItem value="santander">Santander</SelectItem>
                          <SelectItem value="bb">Banco do Brasil</SelectItem>
                          <SelectItem value="caixa">Caixa Econômica</SelectItem>
                          <SelectItem value="inter">Inter</SelectItem>
                          <SelectItem value="c6">C6 Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Saldo Inicial (R$)</Label>
                      <Input type="text" value={saldoInicial} onChange={(e) => setSaldoInicial(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" />
                    </div>
                    <Button className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full" onClick={handleSaveConta}>
                      {selectedConta ? 'Atualizar Conta' : 'Salvar Conta'}
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
                          style={{ backgroundColor: conta.cor || '#888' }}
                        >
                          {conta.banco ? conta.banco.substring(0, 2).toUpperCase() : '??'}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{conta.nome}</h4>
                          <p className="text-xs text-gray-600">{conta.banco}</p>
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditConta(conta)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteConta(conta.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Saldo Atual</span>
                        <span className="text-lg font-bold text-gray-900">R$ {conta.saldo_atual?.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Saldo Inicial: R$ {conta.saldo_inicial?.toLocaleString('pt-BR')}</span>
                        <span className={cn(
                          "font-medium flex items-center gap-1",
                          variacao >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {variacao >= 0 ? '+' : ''}{percentVariacao.toFixed(1)}%
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
              <Dialog open={isNewCartaoOpen} onOpenChange={(open) => {
                setIsNewCartaoOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full" size="sm" onClick={() => {
                    resetForm();
                    setIsNewCartaoOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Cartão
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{selectedCartao ? 'Editar Cartão' : 'Adicionar Cartão de Crédito'}</DialogTitle>
                    <DialogDescription>Configure as datas do seu cartão para melhor controle financeiro</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome do Cartão</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank Platinum" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dia de Fechamento</Label>
                        <Input type="number" min="1" max="31" value={diaFechamento} onChange={(e) => setDiaFechamento(e.target.value)} placeholder="10" />
                      </div>
                      <div className="space-y-2">
                        <Label>Dia de Vencimento</Label>
                        <Input type="number" min="1" max="31" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} placeholder="20" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Limite (R$)</Label>
                      <Input type="text" value={limite} onChange={(e) => setLimite(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" />
                    </div>
                    <Button className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full" onClick={handleSaveCartao}>
                      {selectedCartao ? 'Atualizar Cartão' : 'Salvar Cartão'}
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
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCartao(cartao)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteCartao(cartao.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Utilizado: R$ {cartao.usado?.toLocaleString('pt-BR') || '0,00'}</span>
                        <span className="text-gray-600">Limite: R$ {cartao.limite.toLocaleString('pt-BR')}</span>
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
                  <p className="text-sm">R$ {selectedCartao.limite.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Utilizado</Label>
                  <p className="text-sm">R$ {selectedCartao.usado?.toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 border-t pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsCartaoDetailOpen(false)}>Fechar</Button>
                <Button variant="outline" className="flex-1" onClick={() => openEditCartao(selectedCartao)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleDeleteCartao(selectedCartao.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
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
                  <Label className="text-xs text-muted-foreground">Saldo Atual</Label>
                  <p className="text-sm font-bold">R$ {selectedConta.saldo_atual?.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Saldo Inicial</Label>
                  <p className="text-sm">R$ {selectedConta.saldo_inicial?.toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 border-t pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsContaDetailOpen(false)}>Fechar</Button>
                <Button variant="outline" className="flex-1" onClick={() => openEditConta(selectedConta)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleDeleteConta(selectedConta.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
