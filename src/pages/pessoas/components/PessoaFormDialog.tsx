import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Landmark, Loader2, User, Briefcase, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { formatCPF, formatCNPJ, formatPhone, formatRG, formatAgency, formatBankAccount } from "@/lib/maskUtils";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  PESSOA_STATUS,
  PESSOA_STATUS_LABELS,
  type ContractType,
  type PessoaStatus,
} from "@/constants";
import { DatePicker } from "@/components/ui/date-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pessoaSchema, pessoaDefaultValues, type PessoaFormData } from "@/schemas";
import { Badge } from "@/components/ui/badge";
import { detectTipoChavePix, normalizarChavePix, TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";
import type { Pessoa, ContaBancaria, ChavePix } from "../types";

interface PessoaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPessoa: Pessoa | null;
  onSaved: () => void;
}

function parseSupabaseError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e.code === "23505") {
    const msg = (e.message ?? "").toLowerCase();
    if (msg.includes("cpf")) return "CPF já cadastrado na empresa";
    if (msg.includes("email")) return "Email já cadastrado na empresa";
    if (msg.includes("telefone")) return "Telefone já cadastrado na empresa";
    return "Registro duplicado — verifique CPF, email ou telefone";
  }
  if (e.code === "23502") return `Campo obrigatório não preenchido: ${e.message}`;
  return e.message ?? "Erro desconhecido";
}

type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string; icon: typeof User; desc: string }[] = [
  { id: 1, label: "Identidade", icon: User, desc: "Nome, cargo e contato" },
  { id: 2, label: "Vínculo", icon: Briefcase, desc: "Contrato, salário e datas" },
  { id: 3, label: "Dados Bancários", icon: Landmark, desc: "Contas para pagamento" },
];

export function PessoaFormDialog({ open, onOpenChange, editPessoa, onSaved }: PessoaFormDialogProps) {
  const isEditMode = editPessoa !== null;
  // Na criação todos veem/gravam os campos sensíveis. Na edição, quem não
  // tem acesso à folha abre o registro mascarado (salário/contas/PIX/CPF vêm
  // nulos/mascarados da view pessoas_safe); esconder e NÃO gravar esses campos
  // evita sobrescrever os valores reais com o placeholder.
  const canEditSensitive = !isEditMode || (editPessoa?.pode_ver_sensivel ?? false);

  const form = useForm<PessoaFormData>({
    resolver: zodResolver(pessoaSchema),
    defaultValues: pessoaDefaultValues,
    // Sem isto, os erros disparados via form.trigger() no wizard ficam "presos"
    // (reValidateMode só age após submit). onChange limpa o erro ao corrigir o campo.
    mode: "onChange",
  });

  const { isSubmitting } = form.formState;

  const tipoContrato = form.watch("tipo_contrato");
  const isPJ = tipoContrato === CONTRACT_TYPES.PJ;
  const isCLT = tipoContrato === CONTRACT_TYPES.CLT;
  const isEstagio = tipoContrato === CONTRACT_TYPES.ESTAGIARIO;

  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  const [chavesPix, setChavesPix] = useState<ChavePix[]>([]);
  const [newChavePix, setNewChavePix] = useState("");

  const [step, setStep] = useState<Step>(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (editPessoa) {
      form.reset({
        primeiro_nome: editPessoa.primeiro_nome || editPessoa.nome?.split(" ")[0] || "",
        sobrenome: editPessoa.sobrenome ?? (editPessoa.nome ? editPessoa.nome.split(" ").slice(1).join(" ") : ""),
        cpf: editPessoa.cpf || "",
        rg: editPessoa.rg || "",
        data_nascimento: editPessoa.data_nascimento || "",
        tipo_contrato: (editPessoa.tipo_contrato as ContractType) || CONTRACT_TYPES.CLT,
        status: (editPessoa.status as PessoaStatus) || PESSOA_STATUS.ATIVO,
        cargo: editPessoa.cargo,
        telefone: editPessoa.telefone || "",
        email: editPessoa.email || "",
        endereco: editPessoa.endereco || "",
        data_admissao: editPessoa.data_admissao || "",
        data_demissao: editPessoa.data_demissao || "",
        salario_fixo: editPessoa.salario_fixo != null ? formatValorToInput(editPessoa.salario_fixo) : "",
        valor_m2: editPessoa.valor_m2 != null ? formatValorToInput(editPessoa.valor_m2) : "",
        cnpj: editPessoa.cnpj || "",
        razao_social: editPessoa.razao_social || "",
        pis_nit: editPessoa.pis_nit || "",
      });
      setContasBancarias(Array.isArray(editPessoa.contas_bancarias) ? editPessoa.contas_bancarias : []);
      setChavesPix(Array.isArray(editPessoa.chaves_pix) ? editPessoa.chaves_pix : []);
    } else {
      form.reset(pessoaDefaultValues);
      setContasBancarias([]);
      setChavesPix([]);
    }

    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setNewChavePix("");
  }, [open, editPessoa, form]);

  const handleAddConta = () => {
    if (!newConta.banco || !newConta.agencia || !newConta.conta) {
      toast.error("Dados incompletos", { description: "Preencha banco, agência e conta" });
      return;
    }
    const isFirst = contasBancarias.length === 0;
    setContasBancarias((prev) => [...prev, { ...newConta, is_primary: isFirst }]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  };

  const handleSetPrimaryConta = (index: number) => {
    setContasBancarias((prev) => prev.map((conta, i) => ({ ...conta, is_primary: i === index })));
  };

  const handleAddChavePix = () => {
    const tipo = detectTipoChavePix(newChavePix);
    if (!newChavePix.trim() || !tipo) {
      toast.error("Chave PIX inválida", { description: "Use CPF, CNPJ, e-mail, celular ou chave aleatória" });
      return;
    }
    const normalizada = normalizarChavePix(newChavePix, tipo);
    if (chavesPix.some((c) => c.chave === normalizada)) {
      toast.error("Chave já cadastrada");
      return;
    }
    setChavesPix((prev) => [...prev, { chave: normalizada, tipo }]);
    setNewChavePix("");
  };

  const handleRemoveChavePix = (index: number) => {
    setChavesPix((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveConta = (index: number) => {
    setContasBancarias((prev) => {
      const newContas = prev.filter((_, i) => i !== index);
      if (prev[index].is_primary && newContas.length > 0) newContas[0].is_primary = true;
      return newContas;
    });
  };

  const goNext = async () => {
    if (step === 1) {
      const valid = await form.trigger(["primeiro_nome", "cargo", "email", "cpf"]);
      if (!valid) return;
    }
    if (step === 2 && isPJ) {
      const valid = await form.trigger(["cnpj"]);
      if (!valid) return;
    }
    setStep((step + 1) as Step);
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const goToStep = (target: Step) => {
    if (isEditMode || target < step) {
      setStep(target);
    }
  };

  const step1Keys = ["primeiro_nome", "sobrenome", "cpf", "cargo", "email"] as const;
  const step2Keys = ["tipo_contrato", "cnpj", "salario_fixo", "data_admissao", "data_demissao"] as const;

  const handleSubmit = form.handleSubmit(
    async (formData: PessoaFormData) => {
      // Flush de input pendente: se o usuário digitou uma conta ou PIX e não
      // clicou "+", não perder o dado em silêncio. Comita o que está completo;
      // bloqueia e avisa se estiver incompleto/inválido.
      let finalContas = contasBancarias;
      const contaTouched = newConta.banco || newConta.agencia || newConta.conta;
      if (contaTouched) {
        if (!newConta.banco || !newConta.agencia || !newConta.conta) {
          setStep(3);
          toast.error("Conta bancária incompleta", {
            description: "Preencha banco, agência e conta ou limpe o campo antes de salvar",
          });
          return;
        }
        finalContas = [...contasBancarias, { ...newConta, is_primary: contasBancarias.length === 0 }];
        setContasBancarias(finalContas);
        setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
      }

      let finalPix = chavesPix;
      if (newChavePix.trim()) {
        const tipoPix = detectTipoChavePix(newChavePix);
        if (!tipoPix) {
          setStep(3);
          toast.error("Chave PIX inválida", { description: "Corrija ou limpe o campo antes de salvar" });
          return;
        }
        const normalizada = normalizarChavePix(newChavePix, tipoPix);
        finalPix = chavesPix.some((c) => c.chave === normalizada)
          ? chavesPix
          : [...chavesPix, { chave: normalizada, tipo: tipoPix }];
        setChavesPix(finalPix);
        setNewChavePix("");
      }

      try {
        const primeiroNome = formData.primeiro_nome.trim();
        const sobrenome = formData.sobrenome.trim();
        const payload = {
          primeiro_nome: primeiroNome,
          sobrenome: sobrenome || null,
          nome: [primeiroNome, sobrenome].filter(Boolean).join(" "),
          cpf: formData.cpf || null,
          rg: formData.rg || null,
          data_nascimento: formData.data_nascimento || null,
          tipo_contrato: formData.tipo_contrato,
          status: formData.status,
          cargo: formData.cargo,
          telefone: formData.telefone || null,
          email: formData.email,
          endereco: formData.endereco?.trim() || null,
          data_admissao: formData.data_admissao || null,
          data_demissao: formData.data_demissao || null,
          contas_bancarias: finalContas,
          chaves_pix: finalPix,
          salario_fixo: formData.salario_fixo ? parseCurrencyString(formData.salario_fixo) : null,
          valor_m2: formData.valor_m2 ? parseCurrencyString(formData.valor_m2) : null,
          cnpj: formData.tipo_contrato === CONTRACT_TYPES.PJ ? formData.cnpj || null : null,
          razao_social: formData.tipo_contrato === CONTRACT_TYPES.PJ ? formData.razao_social || null : null,
          pis_nit: formData.tipo_contrato === CONTRACT_TYPES.CLT ? formData.pis_nit || null : null,
        };

        if (isEditMode && editPessoa) {
          // Quem não vê folha não pode sobrescrever os campos sensíveis: remove
          // do UPDATE para o banco preservar os valores existentes.
          const updatePayload: Record<string, unknown> = { ...payload };
          if (!canEditSensitive) {
            delete updatePayload.cpf;
            delete updatePayload.salario_fixo;
            delete updatePayload.valor_m2;
            delete updatePayload.contas_bancarias;
            delete updatePayload.chaves_pix;
          }
          const { error } = await supabase
            .from("pessoas")
            .update(updatePayload as never)
            .eq("id", editPessoa.id);
          if (error) throw error;
          toast.success("Pessoa atualizada", { description: "Dados atualizados com sucesso" });
        } else {
          const { data: empresaId, error: empresaError } = await supabase.rpc("get_user_empresa_id");
          if (empresaError || !empresaId) {
            throw (
              empresaError ??
              new Error("Não foi possível identificar sua empresa. Recarregue a página e tente de novo.")
            );
          }
          const { error } = await supabase.from("pessoas").insert({
            ...payload,
            empresa_id: empresaId,
          } as never);
          if (error) throw error;
          toast.success("Pessoa cadastrada", { description: "Nova pessoa adicionada com sucesso" });
        }

        onOpenChange(false);
        onSaved();
      } catch (err) {
        toast.error(parseSupabaseError(err));
      }
    },
    (errors) => {
      if (step1Keys.some((k) => k in errors)) setStep(1);
      else if (step2Keys.some((k) => k in errors)) setStep(2);
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            <DialogDescription>{STEPS.find((s) => s.id === step)?.desc}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-6 py-3 border-b">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            const isClickable = isEditMode || s.id <= step;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => isClickable && goToStep(s.id)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center gap-2 flex-1 p-2 rounded-lg transition-colors text-left",
                    isClickable && "hover:bg-muted",
                    !isClickable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                      isActive && "bg-brand text-ink",
                      isCompleted && "bg-brand text-ink",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <div className="hidden sm:block min-w-0">
                    <p
                      className={cn(
                        "text-xs font-medium truncate",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Passo {s.id}</p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1 mx-1", step > s.id ? "bg-brand" : "bg-muted")} />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="divide-y">
          {/* STEP 1 — Identidade */}
          {step === 1 && (
            <div className="px-6 py-4 space-y-3">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Dados Pessoais</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="primeiro_nome" className="text-xs">
                    Nome *
                  </Label>
                  <Input
                    id="primeiro_nome"
                    {...form.register("primeiro_nome")}
                    placeholder="Nome"
                    aria-invalid={!!form.formState.errors.primeiro_nome}
                    aria-describedby={form.formState.errors.primeiro_nome ? "primeiro_nome-error" : undefined}
                    className={cn(form.formState.errors.primeiro_nome && "border-destructive focus-visible:ring-destructive")}
                  />
                  {form.formState.errors.primeiro_nome && (
                    <p id="primeiro_nome-error" className="text-xs text-danger-mid">
                      {form.formState.errors.primeiro_nome.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sobrenome" className="text-xs">
                    Sobrenome
                  </Label>
                  <Input
                    id="sobrenome"
                    {...form.register("sobrenome")}
                    placeholder="Sobrenome"
                    aria-invalid={!!form.formState.errors.sobrenome}
                    aria-describedby={form.formState.errors.sobrenome ? "sobrenome-error" : undefined}
                    className={cn(form.formState.errors.sobrenome && "border-destructive focus-visible:ring-destructive")}
                  />
                  {form.formState.errors.sobrenome && (
                    <p id="sobrenome-error" className="text-xs text-danger-mid">
                      {form.formState.errors.sobrenome.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpf" className="text-xs">
                    CPF
                  </Label>
                  <Input
                    id="cpf"
                    value={form.watch("cpf")}
                    onChange={(e) => form.setValue("cpf", formatCPF(e.target.value), { shouldValidate: true })}
                    maxLength={14}
                    placeholder="000.000.000-00"
                    disabled={!canEditSensitive}
                    aria-invalid={!!form.formState.errors.cpf}
                    aria-describedby={form.formState.errors.cpf ? "cpf-error" : undefined}
                    className={cn(form.formState.errors.cpf && "border-destructive focus-visible:ring-destructive")}
                  />
                  {!canEditSensitive && (
                    <p className="text-[10px] text-muted-foreground">CPF completo restrito a quem tem acesso à folha</p>
                  )}
                  {form.formState.errors.cpf && (
                    <p className="text-xs text-danger-mid">{form.formState.errors.cpf.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rg" className="text-xs">
                    RG
                  </Label>
                  <Input
                    id="rg"
                    value={form.watch("rg")}
                    onChange={(e) => form.setValue("rg", formatRG(e.target.value))}
                    maxLength={12}
                    placeholder="00.000.000-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="data_nascimento_picker" className="text-xs">
                    Data de Nascimento
                  </Label>
                  <DatePicker
                    id="data_nascimento_picker"
                    value={form.watch("data_nascimento") || undefined}
                    onChange={(v) => form.setValue("data_nascimento", v)}
                    placeholder="dd/mm/aaaa"
                    captionLayout="dropdown"
                    fromYear={1940}
                    toYear={new Date().getFullYear()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cargo" className="text-xs">
                    Cargo/Função *
                  </Label>
                  <Input
                    id="cargo"
                    {...form.register("cargo")}
                    placeholder="Ex: Arquiteto, Projetista"
                    aria-invalid={!!form.formState.errors.cargo}
                    aria-describedby={form.formState.errors.cargo ? "cargo-error" : undefined}
                    className={cn(form.formState.errors.cargo && "border-destructive focus-visible:ring-destructive")}
                  />
                  {form.formState.errors.cargo && (
                    <p id="cargo-error" className="text-xs text-danger-mid">
                      {form.formState.errors.cargo.message}
                    </p>
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
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="email@exemplo.com"
                    aria-invalid={!!form.formState.errors.email}
                    aria-describedby={form.formState.errors.email ? "email-error" : undefined}
                    className={cn(form.formState.errors.email && "border-destructive focus-visible:ring-destructive")}
                  />
                  {form.formState.errors.email && (
                    <p id="email-error" className="text-xs text-danger-mid">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="endereco" className="text-xs">
                    Endereço
                  </Label>
                  <Input id="endereco" {...form.register("endereco")} placeholder="Endereço completo" />
                </div>
              </div>
              {!isEditMode && (
                <p className="text-xs text-muted-foreground">
                  Precisa só de nome, email e cargo. Documento, salário e conta você completa quando a pessoa entrar na
                  folha.
                </p>
              )}
            </div>
          )}

          {/* STEP 2 — Vínculo */}
          {step === 2 && (
            <>
              <div className="px-6 py-4 space-y-3">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Vínculo</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo_contrato" className="text-xs">
                      Tipo de Contrato
                    </Label>
                    <Select
                      value={form.watch("tipo_contrato")}
                      onValueChange={(value) => form.setValue("tipo_contrato", value as ContractType)}
                    >
                      <SelectTrigger id="tipo_contrato">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(CONTRACT_TYPES).map((type) => (
                          <SelectItem key={type} value={type}>
                            {CONTRACT_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="status_pessoa" className="text-xs">
                      Status
                    </Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(value) => form.setValue("status", value as PessoaStatus)}
                    >
                      <SelectTrigger id="status_pessoa">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PESSOA_STATUS).map((status) => (
                          <SelectItem key={status} value={status}>
                            {PESSOA_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {isPJ && (
                <div className="px-6 py-4 space-y-3 bg-highlight-soft/30">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Dados PJ</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cnpj" className="text-xs">
                        CNPJ *
                      </Label>
                      <Input
                        id="cnpj"
                        value={form.watch("cnpj")}
                        onChange={(e) => form.setValue("cnpj", formatCNPJ(e.target.value), { shouldValidate: true })}
                        maxLength={18}
                        placeholder="00.000.000/0000-00"
                        aria-invalid={!!form.formState.errors.cnpj}
                        aria-describedby={form.formState.errors.cnpj ? "cnpj-error" : undefined}
                        className={cn(form.formState.errors.cnpj && "border-destructive focus-visible:ring-destructive")}
                      />
                      {form.formState.errors.cnpj && (
                        <p id="cnpj-error" className="text-xs text-danger-mid">
                          {form.formState.errors.cnpj.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="razao_social" className="text-xs">
                        Razão Social
                      </Label>
                      <Input id="razao_social" {...form.register("razao_social")} placeholder="Razão social da PJ" />
                    </div>
                  </div>
                </div>
              )}

              {isCLT && (
                <div className="px-6 py-4 space-y-3 bg-info-soft/30">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Dados CLT</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pis_nit" className="text-xs">
                        PIS/NIT
                      </Label>
                      <Input id="pis_nit" {...form.register("pis_nit")} placeholder="000.00000.00-0" />
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 space-y-3">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                  Remuneração e Datas
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {canEditSensitive && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="salario_fixo" className="text-xs">
                          {isEstagio ? "Bolsa (R$)" : "Salário Fixo (R$)"}
                        </Label>
                        <MoneyInput
                          id="salario_fixo"
                          value={form.watch("salario_fixo")}
                          onChange={(v) => form.setValue("salario_fixo", v)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="valor_m2" className="text-xs">
                          Valor m² (R$)
                        </Label>
                        <MoneyInput
                          id="valor_m2"
                          value={form.watch("valor_m2")}
                          onChange={(v) => form.setValue("valor_m2", v)}
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="data_admissao_picker" className="text-xs">
                      Admissão
                    </Label>
                    <DatePicker
                      id="data_admissao_picker"
                      value={form.watch("data_admissao") || undefined}
                      onChange={(v) => form.setValue("data_admissao", v)}
                      placeholder="dd/mm/aaaa"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="data_demissao_picker" className="text-xs">
                      Demissão
                    </Label>
                    <DatePicker
                      id="data_demissao_picker"
                      value={form.watch("data_demissao") || undefined}
                      onChange={(v) => {
                        form.setValue("data_demissao", v);
                        if (v && form.getValues("status") === PESSOA_STATUS.ATIVO) {
                          form.setValue("status", PESSOA_STATUS.INATIVO);
                        }
                      }}
                      placeholder="dd/mm/aaaa"
                    />
                    {form.formState.errors.data_demissao && (
                      <p className="text-xs text-danger-mid">{form.formState.errors.data_demissao.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STEP 3 — Dados Bancários */}
          {step === 3 &&
            (canEditSensitive ? (
              <>
                <div className="px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                      Contas Bancárias
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Opcional</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Você pode salvar sem preencher e adicionar a conta depois. Se for cadastrar uma conta, precisa de
                    banco, agência e número.
                  </p>

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
                      <Select
                        value={newConta.tipo}
                        onValueChange={(value) => setNewConta({ ...newConta, tipo: value })}
                      >
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
                        aria-label="Adicionar conta"
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
                          className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? "border-brand/40" : ""}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              type="button"
                              className="shrink-0"
                              onClick={() => handleSetPrimaryConta(index)}
                              title="Definir como principal"
                            >
                              <Landmark
                                className={`h-4 w-4 ${conta.is_primary ? "text-foreground" : "text-muted-foreground/40"}`}
                              />
                            </button>
                            <span className="font-medium truncate">{conta.banco}</span>
                            <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
                              Ag. {conta.agencia} / Cc. {conta.conta}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize shrink-0">{conta.tipo}</span>
                            {conta.is_primary && (
                              <span className="text-[10px] text-foreground font-medium">Principal</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-danger-mid shrink-0"
                            onClick={() => handleRemoveConta(index)}
                            aria-label="Remover conta"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 space-y-3">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Chaves PIX</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                        value={newChavePix}
                        onChange={(e) => setNewChavePix(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddChavePix())}
                      />
                      {newChavePix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          {(() => {
                            const t = detectTipoChavePix(newChavePix);
                            return t ? TIPO_CHAVE_PIX_LABEL[t] : "...";
                          })()}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0"
                      onClick={handleAddChavePix}
                      aria-label="Adicionar chave PIX"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {chavesPix.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {chavesPix.map((c, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs">
                          <span className="text-[10px] text-muted-foreground">
                            {TIPO_CHAVE_PIX_LABEL[c.tipo as keyof typeof TIPO_CHAVE_PIX_LABEL] ?? c.tipo}
                          </span>
                          <span className="font-medium">{c.chave}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChavePix(i)}
                            className="ml-0.5 hover:text-danger-mid"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Dados bancários e PIX são restritos a quem tem acesso à folha.
                </p>
              </div>
            ))}

          {/* Footer */}
          <div className="flex items-center gap-2 px-6 py-4 bg-muted/30">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting}>
                Voltar
              </Button>
            ) : (
              <div />
            )}
            <div className="flex-1" />
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            {/* Cadastro leve: na criação, dá pra salvar já no passo 1 (nome +
                email + cargo) e completar vínculo/banco depois. */}
            {step < 3 && !isEditMode && (
              <Button type="button" variant="outline" onClick={() => handleSubmit()} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={goNext} variant="brand" disabled={isSubmitting}>
                Próximo →
              </Button>
            ) : (
              <Button type="button" onClick={() => handleSubmit()} variant="brand" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : isEditMode ? (
                  "Atualizar"
                ) : (
                  "Salvar"
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
