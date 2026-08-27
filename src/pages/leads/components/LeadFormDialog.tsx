import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/FormDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhone, formatCNPJ, validateCNPJ, validateEmail, onlyDigits } from "@/lib/maskUtils";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { OrigemField } from "@/components/forms/OrigemField";
import { ValidatedField } from "@/components/forms/ValidatedField";
import { emailFormatValidator, isPersonalEmail } from "@/lib/emailValidator";

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
  onSubmit: () => void;
  isPending: boolean;
  members: Member[];
};

export function LeadFormDialog({
  open,
  onOpenChange,
  mode,
  formData,
  onFormChange,
  onSubmit,
  isPending,
  members,
}: Props) {
  const isEdit = mode === "edit";
  const prefix = isEdit ? "edit-" : "";
  const cnpjErrorId = `${prefix}cnpj-error`;
  const nomeErrorId = `${prefix}nome-error`;

  const [nomeError, setNomeError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [cnpjError, setCnpjError] = useState("");

  const set = (field: keyof LeadFormData, value: string) => {
    if (field === "nome" && nomeError) setNomeError("");
    if (field === "email" && emailError) setEmailError("");
    if (field === "cnpj" && cnpjError) setCnpjError("");
    onFormChange({ ...formData, [field]: value });
  };

  const handleCnpjBlur = () => {
    if (onlyDigits(formData.cnpj).length > 0 && !validateCNPJ(formData.cnpj)) {
      setCnpjError("CNPJ inválido");
    } else {
      setCnpjError("");
    }
  };

  const handleSubmit = () => {
    let hasError = false;

    if (!formData.nome.trim()) {
      setNomeError("Informe o nome do lead");
      hasError = true;
    } else {
      setNomeError("");
    }

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
    onSubmit();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar lead" : "Novo lead"}
      description={isEdit ? "Atualize as informações do lead" : "Cadastre um novo lead no sistema"}
      size="md"
      onSubmit={handleSubmit}
      isPending={isPending}
    >
      <div className="space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Informações do Lead</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}nome`} className="text-xs">
              Nome *
            </Label>
            <Input
              id={`${prefix}nome`}
              value={formData.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Primeiro nome"
              required
              aria-invalid={!!nomeError}
              aria-describedby={nomeError ? nomeErrorId : undefined}
              className={nomeError ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            {nomeError && (
              <p id={nomeErrorId} role="alert" className="text-xs text-destructive">
                {nomeError}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}sobrenome`} className="text-xs">
              Sobrenome
            </Label>
            <Input
              id={`${prefix}sobrenome`}
              value={formData.sobrenome}
              onChange={(e) => set("sobrenome", e.target.value)}
              placeholder="Sobrenome"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}empresa_lead`} className="text-xs">
              Empresa
            </Label>
            <Input
              id={`${prefix}empresa_lead`}
              value={formData.empresa_lead}
              onChange={(e) => set("empresa_lead", e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}cnpj`} className="text-xs">
              CNPJ
            </Label>
            <Input
              id={`${prefix}cnpj`}
              value={formData.cnpj}
              onChange={(e) => set("cnpj", formatCNPJ(e.target.value))}
              onBlur={handleCnpjBlur}
              maxLength={18}
              placeholder="00.000.000/0000-00"
              aria-invalid={!!cnpjError}
              aria-describedby={cnpjError ? cnpjErrorId : undefined}
              className={cnpjError ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            {cnpjError && (
              <p id={cnpjErrorId} role="alert" className="text-xs text-destructive">
                {cnpjError}
              </p>
            )}
          </div>
          <ValidatedField
            label="Email"
            name={`${prefix}email`}
            type="email"
            value={formData.email}
            onChange={(v) => set("email", v)}
            placeholder="email@exemplo.com"
            autoComplete="email"
            onValidate={emailFormatValidator}
            error={emailError}
            hint={
              isPersonalEmail(formData.email)
                ? "E-mail pessoal (Gmail, Hotmail...). Se possível, use o e-mail corporativo do contato."
                : undefined
            }
          />
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}contato`} className="text-xs">
              Telefone
            </Label>
            <Input
              id={`${prefix}contato`}
              value={formData.contato}
              onChange={(e) => set("contato", formatPhone(e.target.value))}
              maxLength={15}
              placeholder="(14) 99999-9999"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}valor_estimado`} className="text-xs">
              Valor Estimado
            </Label>
            <MoneyInput
              id={`${prefix}valor_estimado`}
              value={formData.valor_estimado}
              onChange={(v) => set("valor_estimado", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}previsao_fechamento`} className="text-xs">
              Previsão de Fechamento
            </Label>
            <DatePicker
              id={`${prefix}previsao_fechamento`}
              value={formData.previsao_fechamento}
              onChange={(v) => set("previsao_fechamento", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}responsavel_id`} className="text-xs">
              Responsável
            </Label>
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
          <OrigemField id={`${prefix}origem`} value={formData.origem} onChange={(v) => set("origem", v)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}notas`} className="text-xs">
            Notas
          </Label>
          <Textarea
            id={`${prefix}notas`}
            value={formData.notas}
            onChange={(e) => set("notas", e.target.value)}
            placeholder="Observações internas sobre o lead..."
            rows={3}
          />
        </div>
      </div>
    </FormDialog>
  );
}
