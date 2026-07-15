import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Coins, Loader2, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { useFinanceAuxData } from "@/pages/financeiro/hooks/useFinanceAuxData";
import { msgErro } from "./erros";
import type { Draft, DespesaCampos, ReceitaCampos } from "./useChat";

type Tipo = "receita" | "despesa";
type Campos = ReceitaCampos & DespesaCampos;

type Props = {
  index: number;
  draft: Draft;
  tipo: Tipo;
  onConfirmar: (index: number, runId: string, entidade: Tipo, campos: Campos) => Promise<string | undefined>;
  onCancelar: (index: number, runId: string) => Promise<void>;
  onDesfazer: (index: number, runId: string, entidade: Tipo, entityId: string, porGrupo?: boolean) => Promise<void>;
};

const matchNome = <T extends { id: string; nome: string }>(lista: T[], hint?: string): string | undefined => {
  if (!hint) return undefined;
  const alvo = hint.toLowerCase();
  const m = lista.find((x) => x.nome?.toLowerCase().includes(alvo) || alvo.includes((x.nome ?? "").toLowerCase()));
  return m?.id;
};

export function LancamentoCard({ index, draft, tipo, onConfirmar, onCancelar, onDesfazer }: Props) {
  const isReceita = tipo === "receita";
  const aux = useFinanceAuxData(tipo);
  const campos = draft.campos as Campos;
  const [form, setForm] = useState<Campos>({ status: "Pendente", ...campos });
  const [valorDisplay, setValorDisplay] = useState(campos.valor != null ? formatCurrency(campos.valor) : "");
  const [mostrarMais, setMostrarMais] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const contraparteList = isReceita ? aux.clientes : aux.fornecedores;
  const contraparteIdKey: keyof Campos = isReceita ? "cliente_id" : "fornecedor_id";
  const contraparteNomeKey: keyof Campos = isReceita ? "cliente_nome" : "fornecedor_nome";
  const dataQuitacaoKey: keyof Campos = isReceita ? "data_recebimento" : "data_pagamento";
  const statusQuitado = isReceita ? "Recebido" : "Pago";
  const nParcelas = form.parcelas ?? 1;
  const parcelado = nParcelas > 1;
  const valorParcela = parcelado && form.valor ? form.valor / nParcelas : undefined;

  // Despesa: pagamento por Conta OU Cartão (mutuamente exclusivo). Receita sempre por conta.
  const [pgto, setPgto] = useState<"conta" | "cartao">(
    !isReceita && (campos.cartao_id || campos.cartao_nome) ? "cartao" : "conta"
  );
  const cartaoMode = !isReceita && pgto === "cartao";

  const escolherPgto = (modo: "conta" | "cartao") => {
    setPgto(modo);
    if (modo === "cartao") {
      setForm((prev) => ({ ...prev, conta_id: undefined, parcelas: undefined, status: "Pendente" }));
    } else {
      setForm((prev) => ({ ...prev, cartao_id: undefined }));
    }
  };

  // Resolve dicas textuais (*_nome) para IDs quando os selects carregam.
  useEffect(() => {
    if (aux.loading) return;
    setForm((prev) => {
      const next = { ...prev };
      if (!next.categoria_id) next.categoria_id = matchNome(aux.categorias, campos.categoria_nome);
      if (!next.projeto_id) {
        const proj = aux.projetos.find((p) => p.codigo?.toLowerCase().includes((campos.projeto_nome ?? "").toLowerCase()));
        if (campos.projeto_nome && proj) next.projeto_id = proj.id;
      }
      if (!next[contraparteIdKey]) {
        const id = matchNome(contraparteList, campos[contraparteNomeKey] as string | undefined);
        if (id) (next[contraparteIdKey] as string | undefined) = id;
      }
      if (!isReceita && !next.cartao_id) {
        const id = matchNome(aux.cartoes, (campos as { cartao_nome?: string }).cartao_nome);
        if (id) next.cartao_id = id;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aux.loading]);

  const set = (key: keyof Campos, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const criar = async () => {
    if (!form.descricao?.trim()) {
      toast.error("Informe a descrição");
      return;
    }
    if (!form.valor || form.valor <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (cartaoMode && !form.cartao_id) {
      toast.error("Selecione o cartão");
      return;
    }
    if (parcelado && !cartaoMode && !form.data_vencimento) {
      toast.error("Informe a data de vencimento da 1ª parcela");
      return;
    }
    if (!cartaoMode && !parcelado && form.status === statusQuitado && !form.conta_id) {
      toast.error(`Selecione a conta para ${isReceita ? "o recebimento" : "o pagamento"}`);
      return;
    }
    // Cartão: despesa nasce Pendente (quita ao pagar a fatura) e sem conta.
    const payload: Campos = cartaoMode
      ? { ...form, status: "Pendente", conta_id: undefined, parcelas: undefined }
      : { ...form, cartao_id: undefined };
    setSalvando(true);
    try {
      await onConfirmar(index, draft.runId, tipo, payload);
      toast.success(isReceita ? "Receita lançada" : "Despesa lançada");
    } catch (e) {
      toast.error(`Não foi possível lançar ${isReceita ? "a receita" : "a despesa"}`, { description: msgErro(e) });
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
      await onDesfazer(index, draft.runId, tipo, draft.entityId, parcelado);
      toast.success("Lançamento desfeito");
    } catch {
      toast.error("Não foi possível desfazer");
    } finally {
      setDesfazendo(false);
    }
  };

  const Icon = isReceita ? TrendingUp : TrendingDown;

  if (draft.status === "criado") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 text-positive-strong">
            <Check className="h-3.5 w-3.5" />
          </span>
          {isReceita ? "Receita lançada" : "Despesa lançada"}
        </div>
        <p className="mt-1 pl-8 text-sm text-muted-foreground">
          {form.descricao}
          {form.valor ? ` · ${formatCurrency(form.valor)}` : ""}
        </p>
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
      <div className="w-full max-w-lg rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Rascunho descartado.
      </div>
    );
  }

  const p = `${tipo}-${index}`;
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">
            {isReceita ? "Nova receita" : "Nova despesa"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Revise e edite antes de lançar</p>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${p}-desc`} className="text-xs text-muted-foreground">
            Descrição <span className="text-negative-strong">*</span>
          </Label>
          <Input
            id={`${p}-desc`}
            value={form.descricao ?? ""}
            placeholder={isReceita ? "Ex.: Honorário projeto X" : "Ex.: Material de escritório"}
            onChange={(e) => set("descricao", e.target.value)}
            disabled={salvando}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${p}-valor`} className="text-xs text-muted-foreground">
            Valor <span className="text-negative-strong">*</span>
          </Label>
          <Input
            id={`${p}-valor`}
            value={valorDisplay}
            inputMode="numeric"
            placeholder="R$ 0,00"
            onChange={(e) => {
              const masked = e.target.value ? formatCurrencyInput(e.target.value) : "";
              setValorDisplay(masked);
              set("valor", masked ? parseCurrencyString(masked) : undefined);
            }}
            disabled={salvando}
            className="h-9"
          />
        </div>

        {!cartaoMode && (
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-parcelas`} className="text-xs text-muted-foreground">
              Parcelas
            </Label>
            <Input
              id={`${p}-parcelas`}
              type="number"
              min={1}
              max={360}
              value={form.parcelas ?? ""}
              placeholder="1"
              onChange={(e) => set("parcelas", e.target.value === "" ? undefined : Number(e.target.value))}
              disabled={salvando}
              className="h-9"
            />
          </div>
        )}

        {!parcelado && !cartaoMode && (
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-status`} className="text-xs text-muted-foreground">
              Status
            </Label>
            <Select value={form.status ?? "Pendente"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger id={`${p}-status`} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value={statusQuitado}>{statusQuitado}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {parcelado && valorParcela != null && (
          <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {nParcelas}x de {formatCurrency(valorParcela)} · total {formatCurrency(form.valor ?? 0)} · parcelas mensais, criadas como Pendente
          </div>
        )}

        <button
          type="button"
          onClick={() => setMostrarMais((v) => !v)}
          className="col-span-full flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarMais ? "rotate-180" : ""}`} />
          {mostrarMais ? "Menos campos" : "Categoria, cliente, projeto…"}
        </button>

        {mostrarMais && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`${p}-cat`} className="text-xs text-muted-foreground">
                Categoria
              </Label>
              <Select value={form.categoria_id ?? ""} onValueChange={(v) => set("categoria_id", v)}>
                <SelectTrigger id={`${p}-cat`} className="h-9">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {aux.categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${p}-contraparte`} className="text-xs text-muted-foreground">
                {isReceita ? "Cliente" : "Fornecedor"}
              </Label>
              <Select value={(form[contraparteIdKey] as string) ?? ""} onValueChange={(v) => set(contraparteIdKey, v)}>
                <SelectTrigger id={`${p}-contraparte`} className="h-9">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {contraparteList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${p}-proj`} className="text-xs text-muted-foreground">
                Projeto
              </Label>
              <Select value={form.projeto_id ?? ""} onValueChange={(v) => set("projeto_id", v)}>
                <SelectTrigger id={`${p}-proj`} className="h-9">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {aux.projetos.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {pr.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {!isReceita && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pagamento</Label>
            <div className="flex h-9 items-center gap-1 rounded-lg border border-border p-0.5">
              {(["conta", "cartao"] as const).map((modo) => (
                <button
                  key={modo}
                  type="button"
                  onClick={() => escolherPgto(modo)}
                  disabled={salvando}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    pgto === modo ? "bg-brand text-ink" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {modo === "conta" ? "Conta" : "Cartão"}
                </button>
              ))}
            </div>
          </div>
        )}

        {cartaoMode ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-cartao`} className="text-xs text-muted-foreground">
              Cartão
            </Label>
            <Select value={form.cartao_id ?? ""} onValueChange={(v) => set("cartao_id", v)}>
              <SelectTrigger id={`${p}-cartao`} className="h-9">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {aux.cartoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-conta`} className="text-xs text-muted-foreground">
              Conta {!parcelado && form.status === statusQuitado && <span className="text-negative-strong">*</span>}
            </Label>
            <Select value={form.conta_id ?? ""} onValueChange={(v) => set("conta_id", v)}>
              <SelectTrigger id={`${p}-conta`} className="h-9">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {aux.contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`${p}-venc`} className="text-xs text-muted-foreground">
            {cartaoMode ? "Data da compra" : parcelado ? "Venc. da 1ª parcela" : "Vencimento"}
            {parcelado && !cartaoMode && <span className="text-negative-strong"> *</span>}
          </Label>
          <DatePicker
            id={`${p}-venc`}
            value={(cartaoMode ? form.data_competencia : form.data_vencimento) ?? ""}
            onChange={(v) => set(cartaoMode ? "data_competencia" : "data_vencimento", v)}
          />
        </div>

        {!parcelado && !cartaoMode && (
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-quit`} className="text-xs text-muted-foreground">
              {isReceita ? "Recebimento" : "Pagamento"}
            </Label>
            <DatePicker
              id={`${p}-quit`}
              value={(form[dataQuitacaoKey] as string) ?? ""}
              onChange={(v) => set(dataQuitacaoKey, v)}
            />
          </div>
        )}

        {cartaoMode && (
          <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Despesa de cartão entra na fatura do período (criada como Pendente); a quitação ocorre ao pagar a fatura.
          </div>
        )}

        {mostrarMais && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${p}-obs`} className="text-xs text-muted-foreground">
              Observação
            </Label>
            <Textarea
              id={`${p}-obs`}
              value={form.observacao ?? ""}
              rows={2}
              placeholder="Observações…"
              onChange={(e) => set("observacao", e.target.value)}
              disabled={salvando}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          {isReceita ? "Lançar" : "Lançar"} debita {draft.custoCreditos} crédito{draft.custoCreditos === 1 ? "" : "s"} de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={criar} disabled={salvando} className="gap-1.5 bg-brand text-ink hover:bg-brand/90">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isReceita ? "Lançar receita" : "Lançar despesa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
