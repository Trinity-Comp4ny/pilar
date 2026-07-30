import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { detectTipoChavePix, TIPO_CHAVE_PIX_LABEL, type TipoChavePix } from "@/lib/pixUtils";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import type { ContaItem } from "../hooks/useContasCartoes";

interface ContaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  selectedConta: ContaItem | null;
  nome: string;
  setNome: (v: string) => void;
  banco: string;
  setBanco: (v: string) => void;
  saldoInicial: string;
  setSaldoInicial: (v: string) => void;
  chavePix: string;
  setChavePix: (v: string) => void;
  contaErrors: Record<string, boolean>;
  setContaErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSave: () => void;
}

export function ContaFormDialog({
  open,
  onOpenChange,
  onAddClick,
  selectedConta,
  nome,
  setNome,
  banco,
  setBanco,
  saldoInicial,
  setSaldoInicial,
  chavePix,
  setChavePix,
  contaErrors,
  setContaErrors,
  onSave,
}: ContaFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-6 w-6" onClick={onAddClick} aria-label="Adicionar conta">
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
            <Label>Saldo Inicial (R$)</Label>
            <Input
              type="text"
              value={saldoInicial}
              onChange={(e) => {
                setSaldoInicial(formatCurrencyInput(e.target.value));
                setContaErrors((p) => ({ ...p, saldoInicial: false }));
              }}
              placeholder="R$ 5.000,00"
              className={contaErrors.saldoInicial ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {contaErrors.saldoInicial && <p className="text-xs text-destructive">Campo obrigatório</p>}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Chave PIX
              {chavePix && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {TIPO_CHAVE_PIX_LABEL[detectTipoChavePix(chavePix) as TipoChavePix] ?? "Detectando..."}
                </Badge>
              )}
            </Label>
            <Input
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
            />
          </div>
          <Button variant="brand" className="w-full rounded-full px-5 py-2.5 text-sm" onClick={onSave}>
            {selectedConta ? "Atualizar Conta" : "Salvar Conta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
