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
import { Plus } from "lucide-react";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import type { ContaItem, CartaoItem } from "../hooks/useContasCartoes";

interface CartaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  selectedCartao: CartaoItem | null;
  contas: ContaItem[];
  nome: string;
  setNome: (v: string) => void;
  tipoCartao: "credito" | "debito";
  setTipoCartao: (v: "credito" | "debito") => void;
  diaFechamento: string;
  setDiaFechamento: (v: string) => void;
  diaVencimento: string;
  setDiaVencimento: (v: string) => void;
  limite: string;
  setLimite: (v: string) => void;
  contaPagamentoId: string;
  setContaPagamentoId: (v: string) => void;
  onSave: () => void;
}

export function CartaoFormDialog({
  open,
  onOpenChange,
  onAddClick,
  selectedCartao,
  contas,
  nome,
  setNome,
  tipoCartao,
  setTipoCartao,
  diaFechamento,
  setDiaFechamento,
  diaVencimento,
  setDiaVencimento,
  limite,
  setLimite,
  contaPagamentoId,
  setContaPagamentoId,
  onSave,
}: CartaoFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-6 w-6" onClick={onAddClick} aria-label="Adicionar cartão">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{selectedCartao ? "Editar Cartão" : "Adicionar Cartão"}</DialogTitle>
          <DialogDescription>Configure as datas do seu cartão para melhor controle financeiro</DialogDescription>
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
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank Platinum" />
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
            <p className="text-xs text-muted-foreground">Conta padrão usada ao pagar faturas deste cartão</p>
          </div>
          <Button variant="brand" className="w-full rounded-full px-5 py-2.5 text-sm" onClick={onSave}>
            {selectedCartao ? "Atualizar Cartão" : "Salvar Cartão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
