import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRight, Check, Coins, Loader2, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCNPJ, formatPhone, onlyDigits, validateCNPJ, validateEmail } from "@/lib/maskUtils";
import { formatCurrency, formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { useLeadMembers } from "@/hooks/useLeads";
import type { Draft, LeadCampos } from "./useChat";

type Props = {
  index: number;
  draft: Draft;
  onConfirmar: (index: number, runId: string, entidade: "lead", campos: LeadCampos) => Promise<string | undefined>;
  onCancelar: (index: number, runId: string) => Promise<void>;
  onDesfazer: (index: number, runId: string, entidade: "lead", entityId: string) => Promise<void>;
};

export function LeadConfirmationCard({ index, draft, onConfirmar, onCancelar, onDesfazer }: Props) {
  const { data: members = [] } = useLeadMembers();
  const [form, setForm] = useState<LeadCampos>({
    ...draft.campos,
    contato: draft.campos.contato ? formatPhone(draft.campos.contato) : "",
    cnpj: draft.campos.cnpj ? formatCNPJ(draft.campos.cnpj) : "",
  });
  const [valorDisplay, setValorDisplay] = useState(
    draft.campos.valor_estimado != null ? formatCurrency(draft.campos.valor_estimado) : ""
  );
  const [emailError, setEmailError] = useState("");
  const [cnpjError, setCnpjError] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const set = (key: keyof LeadCampos, value: string | number | undefined) => {
    if (key === "email" && emailError) setEmailError("");
    if (key === "cnpj" && cnpjError) setCnpjError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const criar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Informe o nome do lead");
      return;
    }
    let erro = false;
    if (form.email && !validateEmail(form.email)) {
      setEmailError("E-mail inválido");
      erro = true;
    }
    if (form.cnpj && onlyDigits(form.cnpj).length > 0 && !validateCNPJ(form.cnpj)) {
      setCnpjError("CNPJ inválido");
      erro = true;
    }
    if (erro) return;

    setSalvando(true);
    try {
      await onConfirmar(index, draft.runId, "lead", form);
      toast.success("Lead criado");
    } catch {
      toast.error("Não foi possível criar o lead", { description: "Verifique suas permissões e tente de novo." });
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async () => {
    setSalvando(true);
    try {
      await onCancelar(index, draft.runId);
    } finally {
      setSalvando(false);
    }
  };

  const desfazer = async () => {
    if (!draft.entityId) return;
    setDesfazendo(true);
    try {
      await onDesfazer(index, draft.runId, "lead", draft.entityId);
      toast.success("Lead desfeito");
    } catch {
      toast.error("Não foi possível desfazer");
    } finally {
      setDesfazendo(false);
    }
  };

  // ── Estado: criado ──
  if (draft.status === "criado") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 text-positive">
            <Check className="h-3.5 w-3.5" />
          </span>
          Lead criado
        </div>
        <p className="mt-1 pl-8 text-sm text-muted-foreground">
          {form.nome}
          {form.empresa_lead ? ` · ${form.empresa_lead}` : ""}
        </p>
        <div className="mt-3 flex items-center gap-2 pl-8">
          <NavLink
            to="/leads"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ver em Leads
            <ArrowUpRight className="h-3.5 w-3.5" />
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={desfazer}
            disabled={desfazendo}
            className="h-auto gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {desfazendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Desfazer
          </Button>
        </div>
      </div>
    );
  }

  // ── Estado: cancelado ──
  if (draft.status === "cancelado") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Rascunho descartado.
      </div>
    );
  }

  // ── Estado: pendente (editável, paridade com o formulário da plataforma) ──
  const p = `lead-${index}`;
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink">
          <UserPlus className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">Novo lead</p>
          <p className="mt-1 text-xs text-muted-foreground">Revise e edite antes de criar</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-nome`} className="text-xs text-muted-foreground">
              Nome <span className="text-negative">*</span>
            </Label>
            <Input
              id={`${p}-nome`}
              value={form.nome ?? ""}
              placeholder="Primeiro nome"
              onChange={(e) => set("nome", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-sobrenome`} className="text-xs text-muted-foreground">
              Sobrenome
            </Label>
            <Input
              id={`${p}-sobrenome`}
              value={form.sobrenome ?? ""}
              placeholder="Sobrenome"
              onChange={(e) => set("sobrenome", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-empresa`} className="text-xs text-muted-foreground">
              Empresa
            </Label>
            <Input
              id={`${p}-empresa`}
              value={form.empresa_lead ?? ""}
              placeholder="Nome da empresa"
              onChange={(e) => set("empresa_lead", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-cnpj`} className="text-xs text-muted-foreground">
              CNPJ
            </Label>
            <Input
              id={`${p}-cnpj`}
              value={form.cnpj ?? ""}
              maxLength={18}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              onChange={(e) => set("cnpj", formatCNPJ(e.target.value))}
              disabled={salvando}
              aria-invalid={!!cnpjError}
              className={`h-9 ${cnpjError ? "border-negative focus-visible:ring-negative" : ""}`}
            />
            {cnpjError && <p className="text-xs text-negative">{cnpjError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-email`} className="text-xs text-muted-foreground">
              E-mail
            </Label>
            <Input
              id={`${p}-email`}
              type="email"
              value={form.email ?? ""}
              placeholder="email@exemplo.com"
              onChange={(e) => set("email", e.target.value)}
              disabled={salvando}
              aria-invalid={!!emailError}
              className={`h-9 ${emailError ? "border-negative focus-visible:ring-negative" : ""}`}
            />
            {emailError && <p className="text-xs text-negative">{emailError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-contato`} className="text-xs text-muted-foreground">
              Telefone
            </Label>
            <Input
              id={`${p}-contato`}
              value={form.contato ?? ""}
              maxLength={15}
              inputMode="numeric"
              placeholder="(14) 99999-9999"
              onChange={(e) => set("contato", formatPhone(e.target.value))}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-valor`} className="text-xs text-muted-foreground">
              Valor estimado
            </Label>
            <Input
              id={`${p}-valor`}
              value={valorDisplay}
              inputMode="numeric"
              placeholder="R$ 0,00"
              onChange={(e) => {
                const masked = e.target.value ? formatCurrencyInput(e.target.value) : "";
                setValorDisplay(masked);
                set("valor_estimado", masked ? parseCurrencyString(masked) : undefined);
              }}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-previsao`} className="text-xs text-muted-foreground">
              Previsão de fechamento
            </Label>
            <DatePicker
              id={`${p}-previsao`}
              value={form.previsao_fechamento ?? ""}
              onChange={(v) => set("previsao_fechamento", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-responsavel`} className="text-xs text-muted-foreground">
              Responsável
            </Label>
            <Select value={form.responsavel_id ?? ""} onValueChange={(v) => set("responsavel_id", v)}>
              <SelectTrigger id={`${p}-responsavel`} className="h-9">
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
            <Label htmlFor={`${p}-origem`} className="text-xs text-muted-foreground">
              Origem
            </Label>
            <Input
              id={`${p}-origem`}
              value={form.origem ?? ""}
              placeholder="Ex: Instagram, LinkedIn, Indicação…"
              onChange={(e) => set("origem", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`${p}-notas`} className="text-xs text-muted-foreground">
            Notas
          </Label>
          <Textarea
            id={`${p}-notas`}
            value={form.notas ?? ""}
            rows={2}
            placeholder="Observações internas sobre o lead…"
            onChange={(e) => set("notas", e.target.value)}
            disabled={salvando}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Criar debita {draft.custoCreditos} crédito{draft.custoCreditos === 1 ? "" : "s"} de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={criar}
            disabled={salvando}
            className="gap-1.5 bg-brand text-ink hover:bg-brand/90"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Criar lead
          </Button>
        </div>
      </div>
    </div>
  );
}
