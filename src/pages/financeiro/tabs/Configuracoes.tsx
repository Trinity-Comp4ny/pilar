import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Wallet, Plus, Settings, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Configuracoes() {
  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="vrz-button-primary rounded-full" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Cartão
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Cartão de Crédito</DialogTitle>
                    <DialogDescription>Configure as datas do seu cartão para melhor controle financeiro</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome do Cartão</Label>
                      <Input placeholder="Ex: Nubank Platinum" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dia de Fechamento</Label>
                        <Input type="number" min="1" max="31" placeholder="10" />
                      </div>
                      <div className="space-y-2">
                        <Label>Dia de Vencimento</Label>
                        <Input type="number" min="1" max="31" placeholder="20" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Limite (R$)</Label>
                      <Input type="number" placeholder="10000" />
                    </div>
                    <Button className="w-full vrz-button-primary rounded-full">Salvar Cartão</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { nome: 'Nubank Platinum', fechamento: 10, vencimento: 20, limite: 15000, usado: 4500 },
                { nome: 'Itaú Mastercard', fechamento: 5, vencimento: 15, limite: 10000, usado: 2800 },
                { nome: 'Bradesco Visa', fechamento: 15, vencimento: 25, limite: 8000, usado: 1200 }
              ].map((cartao, idx) => {
                const percentUsed = (cartao.usado / cartao.limite) * 100;
                return (
                  <div key={idx} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-sm">{cartao.nome}</h4>
                        <div className="flex gap-4 mt-1 text-xs text-gray-600">
                          <span>Fecha: dia {cartao.fechamento}</span>
                          <span>Vence: dia {cartao.vencimento}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Utilizado: R$ {cartao.usado.toLocaleString('pt-BR')}</span>
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="vrz-button-primary rounded-full" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Conta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Conta Bancária</DialogTitle>
                    <DialogDescription>Configure sua conta para acompanhamento automático</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome da Conta</Label>
                      <Input placeholder="Ex: Nubank Conta Corrente" />
                    </div>
                    <div className="space-y-2">
                      <Label>Banco</Label>
                      <Select>
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
                      <Input type="number" placeholder="5000.00" step="0.01" />
                    </div>
                    <Button className="w-full vrz-button-primary rounded-full">Salvar Conta</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { nome: 'Nubank Conta', banco: 'Nubank', saldoInicial: 15000, saldoAtual: 18500, cor: '#8A05BE' },
                { nome: 'Itaú Empresarial', banco: 'Itaú', saldoInicial: 25000, saldoAtual: 32000, cor: '#EC7000' },
                { nome: 'Inter PJ', banco: 'Inter', saldoInicial: 10000, saldoAtual: 12500, cor: '#FF7A00' }
              ].map((conta, idx) => {
                const variacao = conta.saldoAtual - conta.saldoInicial;
                const percentVariacao = (variacao / conta.saldoInicial) * 100;
                return (
                  <div key={idx} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: conta.cor }}
                        >
                          {conta.banco.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{conta.nome}</h4>
                          <p className="text-xs text-gray-600">{conta.banco}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Saldo Atual</span>
                        <span className="text-lg font-bold text-gray-900">R$ {conta.saldoAtual.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Saldo Inicial: R$ {conta.saldoInicial.toLocaleString('pt-BR')}</span>
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
      </div>

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
              <p className="text-2xl font-bold text-blue-900">R$ 63.000</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-xs text-orange-700 font-medium mb-1">Usado em Cartões</p>
              <p className="text-2xl font-bold text-orange-900">R$ 8.500</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-purple-700 font-medium mb-1">Limite Disponível</p>
              <p className="text-2xl font-bold text-purple-900">R$ 24.500</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-700 font-medium mb-1">Patrimônio Líquido</p>
              <p className="text-2xl font-bold text-green-900">R$ 54.500</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
