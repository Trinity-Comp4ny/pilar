import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Landmark, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { formatCPF, formatPhone, formatAgency, formatBankAccount } from "@/lib/maskUtils";
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_TYPES, CONTRACT_TYPE_LABELS } from "@/constants";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pessoaSchema, pessoaDefaultValues, type PessoaFormData } from "@/schemas";
import { getSafeErrorMessage } from "@/lib/safeError";
import type { Pessoa, ContaBancaria } from "../types";

interface PessoaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPessoa: Pessoa | null;
  onSaved: () => void;
}

export function PessoaFormDialog({ open, onOpenChange, editPessoa, onSaved }: PessoaFormDialogProps) {
  const { toast } = useToast();
  const isEditMode = editPessoa !== null;
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PessoaFormData>({
    resolver: zodResolver(pessoaSchema),
    defaultValues: pessoaDefaultValues,
  });

  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });

  useEffect(() => {
    if (!open) return;

    if (editPessoa) {
      form.reset({
        nome: editPessoa.nome,
        cpf: editPessoa.cpf || "",
        tipo_contrato: editPessoa.tipo_contrato,
        cargo: editPessoa.cargo,
        telefone: editPessoa.telefone || "",
        email: editPessoa.email || "",
        endereco: editPessoa.endereco || "",
        data_admissao: editPessoa.data_admissao || "",
        data_demissao: editPessoa.data_demissao || "",
        salario_fixo:
          editPessoa.salario_fixo != null ? formatCurrencyInput((editPessoa.salario_fixo * 100).toString()) : "",
        valor_m2: editPessoa.valor_m2 != null ? formatCurrencyInput((editPessoa.valor_m2 * 100).toString()) : "",
      });
      setContasBancarias(Array.isArray(editPessoa.contas_bancarias) ? editPessoa.contas_bancarias : []);
    } else {
      form.reset(pessoaDefaultValues);
      setContasBancarias([]);
    }

    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setIsSaving(false);
  }, [open, editPessoa, form]);

  const handleAddConta = () => {
    if (!newConta.banco || !newConta.agencia || !newConta.conta) {
      toast({ title: "Dados incompletos", description: "Preencha banco, agência e conta", variant: "destructive" });
      return;
    }
    const isFirst = contasBancarias.length === 0;
    setContasBancarias((prev) => [...prev, { ...newConta, is_primary: isFirst }]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  };

  const handleSetPrimaryConta = (index: number) => {
    setContasBancarias((prev) => prev.map((conta, i) => ({ ...conta, is_primary: i === index })));
  };

  const handleRemoveConta = (index: number) => {
    setContasBancarias((prev) => {
      const newContas = prev.filter((_, i) => i !== index);
      if (prev[index].is_primary && newContas.length > 0) newContas[0].is_primary = true;
      return newContas;
    });
  };

  const handleSubmit = form.handleSubmit(async (formData: PessoaFormData) => {
    setIsSaving(true);
    try {
      const payload = {
        nome: formData.nome,
        cpf: formData.cpf,
        tipo_contrato: formData.tipo_contrato,
        cargo: formData.cargo,
        telefone: formData.telefone,
        email: formData.email,
        endereco: formData.endereco,
        data_admissao: formData.data_admissao || null,
        data_demissao: formData.data_demissao || null,
        contas_bancarias: contasBancarias,
        salario_fixo: formData.salario_fixo ? parseCurrencyString(formData.salario_fixo) : null,
        valor_m2: formData.valor_m2 ? parseCurrencyString(formData.valor_m2) : null,
      };

      if (isEditMode && editPessoa) {
        const { error } = await supabase.from("pessoas").update(payload).eq("id", editPessoa.id);
        if (error) throw error;
        toast({ title: "Pessoa atualizada", description: "Dados atualizados com sucesso" });
      } else {
        const { error } = await supabase.from("pessoas").insert({
          ...payload,
          empresa_id: (await supabase.rpc("get_user_empresa_id", {})).data,
        });
        if (error) throw error;
        toast({ title: "Pessoa cadastrada", description: "Nova pessoa adicionada com sucesso" });
      }

      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Erro ao salvar", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Editar Pessoa" : "Nova Pessoa"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Atualize os dados da pessoa" : "Cadastre um novo funcionário ou terceirizado"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="divide-y">
          {/* Tipo de Contrato */}
          <div className="px-6 py-4">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Tipo de Contrato</Label>
            <div className="mt-2">
              <Select
                value={form.watch("tipo_contrato")}
                onValueChange={(value) => form.setValue("tipo_contrato", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CONTRACT_TYPES.CONTRATADO}>
                    {CONTRACT_TYPE_LABELS[CONTRACT_TYPES.CONTRATADO]}
                  </SelectItem>
                  <SelectItem value={CONTRACT_TYPES.TERCEIRIZADO}>
                    {CONTRACT_TYPE_LABELS[CONTRACT_TYPES.TERCEIRIZADO]}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dados Pessoais */}
          <div className="px-6 py-4 space-y-3">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Dados Pessoais</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs">
                  Nome Completo *
                </Label>
                <Input id="nome" {...form.register("nome")} placeholder="Nome completo" />
                {form.formState.errors.nome && (
                  <p className="text-xs text-red-500">{form.formState.errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="text-xs">
                  CPF
                </Label>
                <Input
                  id="cpf"
                  value={form.watch("cpf")}
                  onChange={(e) => form.setValue("cpf", formatCPF(e.target.value))}
                  maxLength={14}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="cargo" className="text-xs">
                  Cargo/Função *
                </Label>
                <Input id="cargo" {...form.register("cargo")} placeholder="Ex: Arquiteto, Engenheiro, Projetista" />
                {form.formState.errors.cargo && (
                  <p className="text-xs text-red-500">{form.formState.errors.cargo.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs">
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={form.watch("telefone")}
                  onChange={(e) => form.setValue("telefone", formatPhone(e.target.value))}
                  maxLength={15}
                  placeholder="(14) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  Email
                </Label>
                <Input id="email" type="email" {...form.register("email")} placeholder="email@exemplo.com" />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="endereco" className="text-xs">
                  Endereço
                </Label>
                <Input id="endereco" {...form.register("endereco")} placeholder="Endereço completo" />
              </div>
            </div>
          </div>

          {/* Remuneração e Datas */}
          <div className="px-6 py-4 space-y-3">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Remuneração e Datas</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="salario_fixo" className="text-xs">
                  Salário Fixo (R$)
                </Label>
                <Input
                  id="salario_fixo"
                  type="text"
                  value={form.watch("salario_fixo")}
                  onChange={(e) => form.setValue("salario_fixo", formatCurrencyInput(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valor_m2" className="text-xs">
                  Valor m² (R$)
                </Label>
                <Input
                  id="valor_m2"
                  type="text"
                  value={form.watch("valor_m2")}
                  onChange={(e) => form.setValue("valor_m2", formatCurrencyInput(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_admissao" className="text-xs">
                  Admissão
                </Label>
                <Input id="data_admissao" type="date" {...form.register("data_admissao")} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_demissao" className="text-xs">
                  Demissão
                </Label>
                <Input id="data_demissao" type="date" {...form.register("data_demissao")} className="h-9" />
              </div>
            </div>
          </div>

          {/* Contas Bancárias */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Contas Bancárias</Label>
              <span className="text-[10px] text-muted-foreground">Para pagamento</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Banco</Label>
                <Input
                  placeholder="Nome do banco"
                  value={newConta.banco}
                  onChange={(e) => setNewConta({ ...newConta, banco: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Agência</Label>
                <Input
                  placeholder="0000"
                  value={newConta.agencia}
                  onChange={(e) => setNewConta({ ...newConta, agencia: formatAgency(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conta</Label>
                <Input
                  placeholder="000000-0"
                  value={newConta.conta}
                  onChange={(e) => setNewConta({ ...newConta, conta: formatBankAccount(e.target.value) })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Select value={newConta.tipo} onValueChange={(value) => setNewConta({ ...newConta, tipo: value })}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={handleAddConta}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {contasBancarias.length > 0 && (
              <div className="space-y-1.5">
                {contasBancarias.map((conta, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? "border-accent-orange/40" : ""}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        className="shrink-0"
                        onClick={() => handleSetPrimaryConta(index)}
                        title="Definir como principal"
                      >
                        <Landmark
                          className={`h-4 w-4 ${conta.is_primary ? "text-accent-orange" : "text-muted-foreground/40"}`}
                        />
                      </button>
                      <span className="font-medium truncate">{conta.banco}</span>
                      <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
                        Ag. {conta.agencia} / Cc. {conta.conta}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize shrink-0">{conta.tipo}</span>
                      {conta.is_primary && (
                        <span className="text-[10px] text-accent-orange font-medium">Principal</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 shrink-0"
                      onClick={() => handleRemoveConta(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-6 py-4 bg-gray-50/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : isEditMode ? (
                "Atualizar"
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
