import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatPhone, formatCNPJ, validateCNPJ, validateEmail, onlyDigits } from "@/lib/maskUtils";
import { formatCurrencyInput } from "@/lib/currencyUtils";

export type LeadFormData = {
  nome: string;
  sobrenome: string;
  email: string;
  contato: string;
  origem: string;
  valor_estimado: string;
  empresa_lead: string;
  cnpj: string;
  previsao_fechamento: string;
  responsavel_id: string;
  notas: string;
};

export const EMPTY_LEAD_FORM: LeadFormData = {
  nome: "",
  sobrenome: "",
  email: "",
  contato: "",
  origem: "",
  valor_estimado: "",
  empresa_lead: "",
  cnpj: "",
  previsao_fechamento: "",
  responsavel_id: "",
  notas: "",
};

type Member = { id: string; first_name: string; last_name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  formData: LeadFormData;
  onFormChange: (data: LeadFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  members: Member[];
};

export function LeadFormDialog({ open, onOpenChange, mode, formData, onFormChange, onSubmit, isPending, members }: Props) {
  const isEdit = mode === "edit";
  const prefix = isEdit ? "edit-" : "";
  const emailErrorId = `${prefix}email-error`;
  const cnpjErrorId = `${prefix}cnpj-error`;

  const [emailError, setEmailError] = useState("");
  const [cnpjError, setCnpjError] = useState("");

  const set = (field: keyof LeadFormData, value: string) => {
    if (field === "email" && emailError) setEmailError("");
    if (field === "cnpj" && cnpjError) setCnpjError("");
    onFormChange({ ...formData, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (formData.email && !validateEmail(formData.email)) {
      setEmailError("E-mail inválido");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (onlyDigits(formData.cnpj).length > 0 && !validateCNPJ(formData.cnpj)) {
      setCnpjError("CNPJ inválido");
      hasError = true;
    } else {
      setCnpjError("");
    }

    if (hasError) return;
    onSubmit(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar Lead" : "Novo Lead"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Atualize as informações do lead" : "Cadastre um novo lead no sistema"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-3">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Informações do Lead</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}nome`} className="text-xs">Nome *</Label>
                <Input
                  id={`${prefix}nome`}
                  value={formData.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="Primeiro nome"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}sobrenome`} className="text-xs">Sobrenome</Label>
                <Input
                  id={`${prefix}sobrenome`}
                  value={formData.sobrenome}
                  onChange={(e) => set("sobrenome", e.target.value)}
                  placeholder="Sobrenome"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}empresa_lead`} className="text-xs">Empresa</Label>
                <Input
                  id={`${prefix}empresa_lead`}
                  value={formData.empresa_lead}
                  onChange={(e) => set("empresa_lead", e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}cnpj`} className="text-xs">CNPJ</Label>
                <Input
                  id={`${prefix}cnpj`}
                  value={formData.cnpj}
                  onChange={(e) => set("cnpj", formatCNPJ(e.target.value))}
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                  aria-invalid={!!cnpjError}
                  aria-describedby={cnpjError ? cnpjErrorId : undefined}
                  className={cnpjError ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {cnpjError && (
                  <p id={cnpjErrorId} role="alert" className="text-xs text-red-600">{cnpjError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}email`} className="text-xs">Email</Label>
                <Input
                  id={`${prefix}email`}
                  type="email"
                  value={formData.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="email@exemplo.com"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? emailErrorId : undefined}
                  className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {emailError && (
                  <p id={emailErrorId} role="alert" className="text-xs text-red-600">{emailError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}contato`} className="text-xs">Telefone</Label>
                <Input
                  id={`${prefix}contato`}
                  value={formData.contato}
                  onChange={(e) => set("contato", formatPhone(e.target.value))}
                  maxLength={15}
                  placeholder="(14) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}valor_estimado`} className="text-xs">Valor Estimado</Label>
                <Input
                  id={`${prefix}valor_estimado`}
                  value={formData.valor_estimado}
                  onChange={(e) => set("valor_estimado", formatCurrencyInput(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}previsao_fechamento`} className="text-xs">Previsão de Fechamento</Label>
                <DatePicker
                  id={`${prefix}previsao_fechamento`}
                  value={formData.previsao_fechamento}
                  onChange={(v) => set("previsao_fechamento", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}responsavel_id`} className="text-xs">Responsável</Label>
                <Select value={formData.responsavel_id} onValueChange={(v) => set("responsavel_id", v)}>
                  <SelectTrigger id={`${prefix}responsavel_id`}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}origem`} className="text-xs">Origem</Label>
                <Input
                  id={`${prefix}origem`}
                  value={formData.origem}
                  onChange={(e) => set("origem", e.target.value)}
                  placeholder="Ex: Instagram, LinkedIn, Indicação..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${prefix}notas`} className="text-xs">Notas</Label>
              <Textarea
                id={`${prefix}notas`}
                value={formData.notas}
                onChange={(e) => set("notas", e.target.value)}
                placeholder="Observações internas sobre o lead..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-2 px-6 py-4 bg-muted/30">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90 text-ink" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
