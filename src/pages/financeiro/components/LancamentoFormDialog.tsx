import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, QrCode, Settings2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { parseCurrencyString } from "@/lib/currencyUtils";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { useChecagemDuplicata } from "../hooks/useChecagemDuplicata";
import { TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";
import { useFinanceAuxData } from "../hooks/useFinanceAuxData";
import { defaultValues, rateiosValidos, schema, type FormData, type FormInput } from "../lib/lancamentoFormSchema";
import { clienteDoProjeto, projetoContinuaValido, projetosDoCliente } from "../lib/vinculoClienteProjeto";
import type { Lancamento, TipoLancamento } from "../hooks/useLancamentosUnified";
import { CentroCustoManager } from "./CentroCustoManager";
import { registrarLancamentoCriado } from "../lib/lancamentoCriado";
import type { Json } from "@/integrations/supabase/types";
import { montarLinhasNovas, statusEmAberto } from "../lib/lancamentoLinhas";

// O form guarda Date; o DatePicker fala ISO (yyyy-MM-dd). Meio-dia evita virar o dia no fuso.
const paraIso = (d: Date | undefined) => (d ? format(d, "yyyy-MM-dd") : undefined);
const deIso = (iso: string) => new Date(`${iso}T12:00:00`);

export interface LancamentoFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: TipoLancamento;
  lancamento?: Lancamento | null;
  onSaved: () => void;
}

export function LancamentoFormDialog({ open, onOpenChange, tipo, lancamento, onSaved }: LancamentoFormDialogProps) {
  const isEdit = !!lancamento;
  const isReceita = tipo === "receita";
  const aux = useFinanceAuxData(tipo as "receita" | "despesa");
  // Recorrência só existe na tabela despesas. Em edição só é seguro
  // mostrar/gravar quando o `lancamento` já traz o valor real (get_lancamentos_pagina
  // devolve a coluna, mas um `Lancamento` montado à mão por fora do RPC pode não
  // trazer) — senão o form mostraria "desligado" e apagaria um valor real ao salvar.
  const recorrenteApplicable = !isReceita && (!isEdit || lancamento?.recorrente !== undefined);

  const form = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(tipo),
  });

  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ccManagerOpen, setCcManagerOpen] = useState(false);
  const [rateios, setRateios] = useState<{ centro_custo_id: string; percentual: string }[]>([]);
  const [rateioOn, setRateioOn] = useState(false);

  const erros = form.formState.errors;
  // No modo cartão o campo Conta some: o erro "efetivado sem conta" (path contaId) aparece no cartão.
  const erroCartao = erros.cartaoId ?? erros.contaId;
  const formaPagamento = form.watch("formaPagamento");
  const isCartaoPayment = formaPagamento === "Cartão de Crédito" || formaPagamento === "Cartão de Débito";
  const tipoCartaoFiltro = formaPagamento === "Cartão de Débito" ? "debito" : "credito";
  const cartoesFiltrados = isCartaoPayment ? aux.cartoes.filter((c) => c.tipo === tipoCartaoFiltro) : aux.cartoes;

  useEffect(() => {
    if (isCartaoPayment) {
      form.setValue("contaId", "");
    } else {
      form.setValue("cartaoId", "");
    }
  }, [isCartaoPayment, form]);

  useEffect(() => {
    if (!open) return;
    if (lancamento) {
      form.reset({
        descricao: lancamento.descricao,
        valorTotal: lancamento.valor.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          style: "currency",
          currency: "BRL",
        }),
        dataVencimento: lancamento.data_vencimento ? new Date(lancamento.data_vencimento + "T12:00:00") : new Date(),
        // "Atrasado" não é escolha do usuário: é Pendente com vencimento passado. O
        // select só oferece Pendente/Pago; ao salvar, statusEmAberto recalcula.
        status:
          lancamento.status === "Recebido"
            ? "Recebida"
            : lancamento.status === "Atrasado"
              ? "Pendente"
              : lancamento.status,
        formaPagamento: lancamento.forma_pagamento ?? "",
        parcelas: "1",
        categoriaId: lancamento.categoria_id ?? "",
        projetoId: lancamento.projeto_id ?? "",
        contaId: lancamento.conta_id ?? "",
        cartaoId: lancamento.cartao_id ?? "",
        clienteId: isReceita ? (lancamento.contraparte_id ?? "") : "",
        fornecedorId: !isReceita ? (lancamento.contraparte_id ?? "") : "",
        centroCustoId: lancamento.centro_custo_id ?? "",
        dataCompetencia: lancamento.data_competencia ? new Date(lancamento.data_competencia + "T12:00:00") : undefined,
        notaFiscal: lancamento.nota_fiscal ?? "",
        observacao: lancamento.observacao ?? "",
        recorrente: lancamento.recorrente ?? false,
        periodicidade: lancamento.periodicidade ?? "mensal",
      });
      if (lancamento.categoria_id || lancamento.projeto_id || lancamento.contraparte_id) setAdvancedOpen(false);

      void (async () => {
        const { data: existingRateios } = await supabase
          .from("lancamento_rateios")
          .select("centro_custo_id, percentual")
          .eq("lancamento_id", lancamento.id)
          .eq("tipo_lancamento", tipo);
        if (existingRateios && existingRateios.length > 0) {
          setRateioOn(true);
          setRateios(
            existingRateios.map((r) => ({
              centro_custo_id: r.centro_custo_id,
              percentual: String(r.percentual),
            }))
          );
        } else {
          setRateioOn(false);
          setRateios([]);
        }
      })();
    } else {
      form.reset(defaultValues(tipo));
      setAdvancedOpen(false);
      setRateioOn(false);
      setRateios([]);
    }
  }, [open, lancamento, tipo]);

  const persistRateio = async (lancamentoId: string, tipoLanc: TipoLancamento) => {
    const validRateios = rateiosValidos(rateioOn, rateios);
    if (validRateios.length === 0) return;
    const { error } = await supabase.rpc("rpc_lancamento_set_rateio", {
      p_lancamento_id: lancamentoId,
      p_tipo_lancamento: tipoLanc,
      p_rateios: validRateios.map((r) => ({
        centro_custo_id: r.centro_custo_id,
        percentual: Number(r.percentual),
      })),
    });
    if (error) throw error;
  };

  const save = async (data: FormData) => {
    setSaving(true);
    try {
      rateiosValidos(rateioOn, rateios); // valida antes de gravar (ver rateiosValidos)
      const numParcelas = Math.min(60, Math.max(1, parseInt(data.parcelas || "1") || 1));
      const valorNum = parseCurrencyString(data.valorTotal);

      const grupoParcela = !isEdit && numParcelas > 1 ? crypto.randomUUID() : null;
      const table = isReceita ? "receitas" : "despesas";

      const dataCompetenciaStr = data.dataCompetencia
        ? format(data.dataCompetencia, "yyyy-MM-dd")
        : format(data.dataVencimento, "yyyy-MM-dd");

      if (isEdit && lancamento) {
        const payload = isReceita
          ? {
              data_vencimento: format(data.dataVencimento, "yyyy-MM-dd"),
              // Mesma regra da despesa: a data real do recebimento não é trocada pelo
              // vencimento ao editar outro campo (diagnóstico 2026-11-07, B3).
              data_recebimento:
                data.status === "Recebida"
                  ? (lancamento.data_efetivacao ?? format(data.dataVencimento, "yyyy-MM-dd"))
                  : null,
              data_competencia: dataCompetenciaStr,
              descricao: data.descricao,
              valor: valorNum,
              status: data.status === "Recebida" ? "Recebido" : statusEmAberto(data.status, data.dataVencimento),
              forma_pagamento: data.formaPagamento || null,
              categoria_id: data.categoriaId || null,
              projeto_id: data.projetoId || null,
              conta_id: data.contaId || null,
              cliente_id: data.clienteId || null,
              centro_custo_id: data.centroCustoId || null,
              nota_fiscal: data.notaFiscal || null,
              observacao: data.observacao || null,
            }
          : {
              data_vencimento: format(data.dataVencimento, "yyyy-MM-dd"),
              data_pagamento:
                data.status === "Pago"
                  ? (lancamento.data_efetivacao ?? format(data.dataVencimento, "yyyy-MM-dd"))
                  : null,
              data_competencia: dataCompetenciaStr,
              descricao: data.descricao,
              valor: valorNum,
              status: statusEmAberto(data.status, data.dataVencimento),
              forma_pagamento: data.formaPagamento || null,
              categoria_id: data.categoriaId || null,
              projeto_id: data.projetoId || null,
              conta_id: data.contaId || null,
              cartao_id: data.cartaoId || null,
              fornecedor_id: data.fornecedorId || null,
              centro_custo_id: data.centroCustoId || null,
              nota_fiscal: data.notaFiscal || null,
              observacao: data.observacao || null,
              ...(recorrenteApplicable
                ? { recorrente: data.recorrente, periodicidade: data.recorrente ? data.periodicidade : null }
                : {}),
            };
        const { error } = await supabase
          .from(table)
          .update(payload as never)
          .eq("id", lancamento.id);
        if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));

        await persistRateio(lancamento.id, tipo);
        toast.success("Lançamento atualizado");
      } else {
        const rows = montarLinhasNovas(data, {
          isReceita,
          numParcelas,
          valorNum,
          grupoParcela,
          dataCompetencia: dataCompetenciaStr,
        });
        // Linhas + rateio numa transação só (rpc_lancamentos_criar): se o rateio
        // falhar, nenhuma parcela fica gravada. empresa_id vem do servidor.
        const { error } = await supabase.rpc("rpc_lancamentos_criar", {
          p_tipo: tipo,
          p_linhas: rows as unknown as Json,
          p_rateios: rateiosValidos(rateioOn, rateios).map((r) => ({
            centro_custo_id: r.centro_custo_id,
            percentual: Number(r.percentual),
          })),
        });
        if (error) throw new Error(error.message + (error.details ? ` (${error.details})` : ""));

        registrarLancamentoCriado(tipo, numParcelas, rateioOn);
        toast.success(isReceita ? "Receita cadastrada" : "Despesa cadastrada", {
          description: `${numParcelas} registro(s) criado(s)`,
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ((e as { message?: string })?.message ?? "Erro desconhecido");
      toast.error("Erro ao salvar", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const duplicata = useChecagemDuplicata({
    isReceita,
    contrapartes: isReceita ? aux.clientes : aux.fornecedores,
    salvar: save,
  });

  const onSubmit = form.handleSubmit(async (data) => {
    if (isEdit) {
      await save(data);
      return;
    }
    await duplicata.verificarESalvar(data);
  });

  const clienteId = form.watch("clienteId") ?? "";
  const clienteSelecionado = aux.clientes.find((c) => c.id === clienteId);
  const chavesPixCliente = clienteSelecionado?.chaves_pix ?? [];

  const statusOptions = isReceita
    ? [
        { value: "Pendente", label: "Pendente" },
        { value: "Recebida", label: "Recebida" },
      ]
    : [
        { value: "Pendente", label: "Pendente" },
        { value: "Pago", label: "Pago" },
      ];

  function RateioSomaBadge({ rateios }: { rateios: { percentual: string }[] }) {
    const soma = rateios.reduce((acc, r) => acc + Number(r.percentual || 0), 0);
    const ok = Math.abs(soma - 100) < 0.01;
    return (
      <Badge
        variant="secondary"
        className={cn(
          "tabular-nums",
          ok ? "bg-positive/10 text-positive-strong" : "bg-warning-soft text-warning-strong"
        )}
      >
        Soma: {soma.toFixed(2)}%
      </Badge>
    );
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`${isEdit ? "Editar" : "Nova"} ${isReceita ? "Receita" : "Despesa"}`}
        description={isEdit ? "Altere os campos e salve" : "Campos obrigatórios marcados com *"}
        size="lg"
        onSubmit={onSubmit}
        isPending={saving}
        submitLabel={isEdit ? "Atualizar" : "Salvar"}
      >
        {/* Linha principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Coluna esquerda — obrigatórios */}
          <div className="space-y-3">
            <p className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">Dados principais</p>

            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs">
                Descrição *
              </Label>
              <Input
                id="descricao"
                {...form.register("descricao")}
                placeholder="Ex: Honorários projeto A"
                className="h-9"
              />
              {form.formState.errors.descricao && (
                <p className="text-xs text-destructive">{form.formState.errors.descricao.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor total (R$) *</Label>
                <MoneyInput
                  value={form.watch("valorTotal")}
                  onChange={(v) => form.setValue("valorTotal", v)}
                  className="h-9"
                />
                {form.formState.errors.valorTotal && (
                  <p className="text-xs text-destructive">{form.formState.errors.valorTotal.message}</p>
                )}
              </div>
              {!isEdit && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcelas</Label>
                  <Input type="number" min="1" max="60" {...form.register("parcelas")} className="h-9" />
                  {erros.parcelas && <p className="text-xs text-destructive">{erros.parcelas.message}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento *</Label>
                <DatePicker
                  value={paraIso(form.watch("dataVencimento"))}
                  onChange={(v) => v && form.setValue("dataVencimento", deIso(v))}
                  placeholder="Selecionar"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={form.watch("formaPagamento")} onValueChange={(v) => form.setValue("formaPagamento", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coluna direita — vínculos */}
          <div className="space-y-3">
            <p className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">Vínculos</p>

            {isReceita ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente (pagante)</Label>
                <Select
                  value={form.watch("clienteId")}
                  onValueChange={(v) => {
                    form.setValue("clienteId", v);
                    if (!projetoContinuaValido(aux.projetos, form.getValues("projetoId"), v))
                      form.setValue("projetoId", "");
                  }}
                >
                  <SelectTrigger aria-label="Cliente (pagante)" className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {aux.clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {chavesPixCliente.length > 0 && (
                  <div className="rounded-md border border-dashed px-3 py-2 space-y-1 bg-muted/30">
                    {chavesPixCliente.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <QrCode className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{c.chave}</span>
                        <Badge variant="outline" className="text-3xs h-4 px-1 ml-auto">
                          {TIPO_CHAVE_PIX_LABEL[c.tipo as keyof typeof TIPO_CHAVE_PIX_LABEL] ?? c.tipo}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Fornecedor</Label>
                <Select value={form.watch("fornecedorId")} onValueChange={(v) => form.setValue("fornecedorId", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {aux.fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Projeto</Label>
              <Select
                value={form.watch("projetoId")}
                onValueChange={(v) => {
                  form.setValue("projetoId", v);
                  const dono = isReceita ? clienteDoProjeto(aux.projetos, v) : null;
                  if (dono) form.setValue("clienteId", dono);
                }}
              >
                <SelectTrigger aria-label="Projeto" className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(isReceita ? projetosDoCliente(aux.projetos, clienteId, form.watch("projetoId")) : aux.projetos).map(
                    (p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={form.watch("categoriaId")} onValueChange={(v) => form.setValue("categoriaId", v)}>
                <SelectTrigger aria-label="Categoria" className="h-9">
                  <SelectValue placeholder="Selecione" />
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

            {isCartaoPayment && !isReceita ? (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {formaPagamento}
                  {form.watch("status") === "Pago" && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Select value={form.watch("cartaoId")} onValueChange={(v) => form.setValue("cartaoId", v)}>
                  <SelectTrigger className={cn("h-9", erroCartao && "border-destructive")}>
                    <SelectValue placeholder="Selecione o cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    {cartoesFiltrados.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {erroCartao && <p className="text-xs text-destructive">{erroCartao.message}</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Conta
                  {(form.watch("status") === "Recebida" || form.watch("status") === "Pago") && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </Label>
                <Select value={form.watch("contaId")} onValueChange={(v) => form.setValue("contaId", v)}>
                  <SelectTrigger className={cn("h-9", form.formState.errors.contaId && "border-destructive")}>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {aux.contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.contaId && (
                  <p className="text-xs text-destructive">{form.formState.errors.contaId.message}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Seção avançada colapsável */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium uppercase tracking-wider">Mais opções</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de competência</Label>
                <DatePicker
                  value={paraIso(form.watch("dataCompetencia"))}
                  onChange={(v) => form.setValue("dataCompetencia", v ? deIso(v) : undefined)}
                  placeholder="Igual ao vencimento"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center justify-between">
                  Centro de custo
                  <button
                    type="button"
                    className="text-3xs text-ink hover:underline inline-flex items-center gap-0.5"
                    onClick={() => setCcManagerOpen(true)}
                  >
                    <Settings2 className="h-3 w-3" /> gerenciar
                  </button>
                </Label>
                <Select
                  value={form.watch("centroCustoId")}
                  onValueChange={(v) => form.setValue("centroCustoId", v)}
                  disabled={rateioOn}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={rateioOn ? "Definido por rateio" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {aux.centrosCusto.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo ? `${c.codigo} — ` : ""}
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-2 rounded-md border p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Rateio entre centros de custo</Label>
                  <button
                    type="button"
                    className={cn(
                      "text-3xs px-2 py-0.5 rounded border",
                      rateioOn ? "bg-brand text-ink border-brand" : "bg-transparent text-muted-foreground"
                    )}
                    onClick={() => {
                      const next = !rateioOn;
                      setRateioOn(next);
                      if (next && rateios.length === 0) {
                        setRateios([
                          { centro_custo_id: "", percentual: "" },
                          { centro_custo_id: "", percentual: "" },
                        ]);
                      }
                    }}
                  >
                    {rateioOn ? "ON" : "OFF"}
                  </button>
                </div>
                {rateioOn && (
                  <>
                    <div className="space-y-1.5">
                      {rateios.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Select
                            value={r.centro_custo_id}
                            onValueChange={(v) =>
                              setRateios((prev) => prev.map((p, idx) => (idx === i ? { ...p, centro_custo_id: v } : p)))
                            }
                          >
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue placeholder="Centro" />
                            </SelectTrigger>
                            <SelectContent>
                              {aux.centrosCusto.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.codigo ? `${c.codigo} — ` : ""}
                                  {c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="%"
                            className="h-8 w-20 text-xs"
                            value={r.percentual}
                            onChange={(e) =>
                              setRateios((prev) =>
                                prev.map((p, idx) => (idx === i ? { ...p, percentual: e.target.value } : p))
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-danger-mid"
                            onClick={() => setRateios((prev) => prev.filter((_, idx) => idx !== i))}
                            aria-label="Remover rateio"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRateios((prev) => [...prev, { centro_custo_id: "", percentual: "" }])}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar centro
                      </Button>
                      <RateioSomaBadge rateios={rateios} />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                {/* Número da NF (antes era um Sim/Não): é o sinal mais forte de duplicata. */}
                <Label htmlFor="nota-fiscal" className="text-xs">
                  Nº da nota fiscal
                </Label>
                <Input id="nota-fiscal" {...form.register("notaFiscal")} placeholder="Ex.: 1234" className="h-9" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Observação</Label>
                <Input {...form.register("observacao")} placeholder="Observações adicionais" className="h-9" />
              </div>

              {recorrenteApplicable && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Recorrência</Label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.watch("recorrente")}
                        onCheckedChange={(checked) => form.setValue("recorrente", checked === true)}
                      />
                      Despesa recorrente
                    </label>
                    {form.watch("recorrente") && (
                      <Select
                        value={form.watch("periodicidade")}
                        onValueChange={(v) => form.setValue("periodicidade", v)}
                      >
                        <SelectTrigger className="h-9 w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="semestral">Semestral</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </FormDialog>

      <CentroCustoManager
        open={ccManagerOpen}
        onOpenChange={setCcManagerOpen}
        onChanged={() => {
          /* aux refreshes on next open of form */
        }}
      />

      {duplicata.dialog}
    </>
  );
}
