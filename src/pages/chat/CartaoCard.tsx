import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRight, Check, Coins, CreditCard, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import type { CartaoCampos, Draft } from "./useChat";

type Props = {
  index: number;
  draft: Draft;
  onConfirmar: (runId: string, entidade: "cartao", campos: CartaoCampos) => Promise<string | undefined>;
  onCancelar: (runId: string) => Promise<void>;
  onDesfazer: (runId: string, entidade: "cartao", entityId: string) => Promise<void>;
};

export function CartaoCard({ index, draft, onConfirmar, onCancelar, onDesfazer }: Props) {
  const campos = draft.campos as CartaoCampos;
  const [form, setForm] = useState<CartaoCampos>({ tipo: "credito", ...campos });
  const [limiteDisplay, setLimiteDisplay] = useState(campos.limite != null ? formatCurrency(campos.limite) : "");
  const [salvando, setSalvando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const set = (key: keyof CartaoCampos, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const criar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Informe o nome do cartão");
      return;
    }
    setSalvando(true);
    try {
      await onConfirmar(draft.runId, "cartao", form);
      toast.success("Cartão cadastrado");
    } catch {
      toast.error("Não foi possível cadastrar o cartão", { description: "Verifique suas permissões e tente de novo." });
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async () => {
    setSalvando(true);
    try {
      await onCancelar(draft.runId);
    } finally {
      setSalvando(false);
    }
  };

  const desfazer = async () => {
    if (!draft.entityId) return;
    setDesfazendo(true);
    try {
      await onDesfazer(draft.runId, "cartao", draft.entityId);
      toast.success("Cartão removido");
    } catch {
      toast.error("Não foi possível desfazer");
    } finally {
      setDesfazendo(false);
    }
  };

  if (draft.status === "criado") {
    return (
      <div className="w-full max-w-md rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 text-positive-strong">
            <Check className="h-3.5 w-3.5" />
          </span>
          Cartão cadastrado
        </div>
        <p className="mt-1 pl-8 text-sm text-muted-foreground">{form.nome}</p>
        <div className="mt-3 flex items-center gap-2 pl-8">
          <NavLink
            to="/financeiro"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ver no Financeiro
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

  if (draft.status === "cancelado") {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Rascunho descartado.
      </div>
    );
  }

  const p = `cartao-${index}`;
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink">
          <CreditCard className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">Novo cartão</p>
          <p className="mt-1 text-xs text-muted-foreground">Revise e edite antes de cadastrar</p>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${p}-nome`} className="text-xs text-muted-foreground">
            Nome <span className="text-negative-strong">*</span>
          </Label>
          <Input
            id={`${p}-nome`}
            value={form.nome ?? ""}
            placeholder="Ex.: Nubank PJ"
            onChange={(e) => set("nome", e.target.value)}
            disabled={salvando}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${p}-limite`} className="text-xs text-muted-foreground">
            Limite
          </Label>
          <Input
            id={`${p}-limite`}
            value={limiteDisplay}
            inputMode="numeric"
            placeholder="R$ 0,00"
            onChange={(e) => {
              const masked = e.target.value ? formatCurrencyInput(e.target.value) : "";
              setLimiteDisplay(masked);
              set("limite", masked ? parseCurrencyString(masked) : undefined);
            }}
            disabled={salvando}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${p}-tipo`} className="text-xs text-muted-foreground">
            Tipo
          </Label>
          <Select value={form.tipo ?? "credito"} onValueChange={(v) => set("tipo", v)}>
            <SelectTrigger id={`${p}-tipo`} className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credito">Crédito</SelectItem>
              <SelectItem value="debito">Débito</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${p}-fech`} className="text-xs text-muted-foreground">
            Dia de fechamento
          </Label>
          <Input
            id={`${p}-fech`}
            type="number"
            min={1}
            max={31}
            value={form.dia_fechamento ?? ""}
            placeholder="1-31"
            onChange={(e) => set("dia_fechamento", e.target.value === "" ? undefined : Number(e.target.value))}
            disabled={salvando}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${p}-venc`} className="text-xs text-muted-foreground">
            Dia de vencimento
          </Label>
          <Input
            id={`${p}-venc`}
            type="number"
            min={1}
            max={31}
            value={form.dia_vencimento ?? ""}
            placeholder="1-31"
            onChange={(e) => set("dia_vencimento", e.target.value === "" ? undefined : Number(e.target.value))}
            disabled={salvando}
            className="h-9"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Cadastrar debita {draft.custoCreditos} crédito{draft.custoCreditos === 1 ? "" : "s"} de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={criar} disabled={salvando} variant="brand" className="gap-1.5">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Cadastrar
          </Button>
        </div>
      </div>
    </div>
  );
}
