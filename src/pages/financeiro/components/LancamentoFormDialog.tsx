import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addMonths } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ChevronDown, Loader2, QrCode, Settings2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { checkDuplicates } from "@/lib/duplicateCheck";
import { DuplicateWarningDialog } from "@/components/DuplicateWarningDialog";
import { TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";
import { useFinanceAuxData } from "../hooks/useFinanceAuxData";
import type { Lancamento, TipoLancamento } from "../hooks/useLancamentosUnified";
import { CentroCustoManager } from "./CentroCustoManager";

const schema = z
  .object({
    descricao: z.string().min(1, "Descrição obrigatória"),
    valorTotal: z.string().min(1, "Valor obrigatório"),
    dataVencimento: z.date({ required_error: "Data obrigatória" }),
    status: z.string(),
    formaPagamento: z.string().optional().default(""),
    parcelas: z.string().optional().default("1"),
    categoriaId: z.string().optional().default(""),
    projetoId: z.string().optional().default(""),
    contaId: z.string().optional().default(""),
    cartaoId: z.string().optional().default(""),
    clienteId: z.string().optional().default(""),
    fornecedorId: z.string().optional().default(""),
    centroCustoId: z.string().optional().default(""),
    dataCompetencia: z.date().optional(),
    notaFiscal: z.string().optional().default(""),
    observacao: z.string().optional().default(""),
  })
  .refine(
    (d) => {
      if (d.status === "Recebida" || d.status === "Pago") return !!(d.contaId || d.cartaoId);
      return true;
    },
    { message: "Conta obrigatória para lançamentos efetivados", path: ["contaId"] }
  )
  .refine((d) => !(d.contaId && d.cartaoId), { message: "Selecione apenas Conta OU Cartão", path: ["cartaoId"] });

type FormData = z.infer<typeof schema>;

export interface LancamentoFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: TipoLancamento;
  lancamento?: Lancamento | null;
  onSaved: () => void;
}

const defaultValues = (tipo: TipoLancamento): FormData => ({
  descricao: "",
  valorTotal: "",
  dataVencimento: new Date(),
  status: tipo === "receita" ? "Pendente" : "Pendente",
  formaPagamento: "",
  parcelas: "1",
  categoriaId: "",
  projetoId: "",
  contaId: "",
  cartaoId: "",
  clienteId: "",
  fornecedorId: "",
  centroCustoId: "",
  dataCompetencia: undefined,
  notaFiscal: "",
  observacao: "",
});

export function LancamentoFormDialog({ open, onOpenChange, tipo, lancamento, onSaved }: LancamentoFormDialogProps) {
  const isEdit = !!lancamento;
  const isReceita = tipo === "receita";
  const aux = useFinanceAuxData(tipo);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(tipo),
  });

  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Awaited<ReturnType<typeof checkDuplicates>>>([]);
  const [showDupWarning, setShowDupWarning] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ccManagerOpen, setCcManagerOpen] = useState(false);
  const [rateios, setRateios] = useState<{ centro_custo_id: string; percentual: string }[]>([]);
  const [rateioOn, setRateioOn] = useState(false);

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
        status: lancamento.status === "Recebido" ? "Recebida" : lancamento.status,
        formaPagamento: lancamento.forma_pagamento ?? "",
        parcelas: "1",
        categoriaId: lancamento.categoria_id ?? "",
        projetoId: lancamento.projeto_id ?? "",
        contaId: "",
        cartaoId: "",
        clienteId: isReceita ? (lancamento.contraparte_id ?? "") : "",
        fornecedorId: !isReceita ? (lancamento.contraparte_id ?? "") : "",
        centroCustoId: lancamento.centro_custo_id ?? "",
        dataCompetencia: lancamento.data_competencia ? new Date(lancamento.data_competencia + "T12:00:00") : undefined,
        notaFiscal: "",
        observacao: "",
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
    if (!rateioOn || rateios.length === 0) return;
    const validRateios = rateios.filter((r) => r.centro_custo_id && r.percentual);
    if (validRateios.length === 0) return;
    const soma = validRateios.reduce((acc, r) => acc + Number(r.percentual || 0), 0);
    if (Math.abs(soma - 100) > 0.01) {
      throw new Error(`Soma dos percentuais do rateio deve ser 100 (atual: ${soma})`);
    }
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
      const numParcelas = parseInt(data.parcelas || "1") || 1;
      const valorNum = parseCurrencyString(data.valorTotal);
      const valorParcela = Math.round((valorNum / numParcelas) * 100) / 100;
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário sem empresa");

      const grupoParcela = !isEdit && numParcelas > 1 ? crypto.randomUUID() : null;
      const table = isReceita ? "receitas" : "despesas";

      const dataCompetenciaStr = data.dataCompetencia
        ? format(data.dataCompetencia, "yyyy-MM-dd")
        : format(data.dataVencimento, "yyyy-MM-dd");

      if (isEdit && lancamento) {
        const payload = isReceita
          ? {
              data_vencimento: format(data.dataVencimento, "yyyy-MM-dd"),
              data_recebimento: data.status === "Recebida" ? format(data.dataVencimento, "yyyy-MM-dd") : null,
              data_competencia: dataCompetenciaStr,
              descricao: data.descricao,
              valor: valorNum,
              status: data.status === "Recebida" ? "Recebido" : data.status,
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
              data_pagamento: data.status === "Pago" ? format(data.dataVencimento, "yyyy-MM-dd") : null,
              data_competencia: dataCompetenciaStr,
              descricao: data.descricao,
              valor: valorNum,
              status: data.status,
              forma_pagamento: data.formaPagamento || null,
              categoria_id: data.categoriaId || null,
              projeto_id: data.projetoId || null,
              conta_id: data.contaId || null,
              cartao_id: data.cartaoId || null,
              fornecedor_id: data.fornecedorId || null,
              centro_custo_id: data.centroCustoId || null,
              nota_fiscal: data.notaFiscal || null,
              observacao: data.observacao || null,
            };
        const { error } = await supabase
          .from(table)
          .update(payload as never)
          .eq("id", lancamento.id);
        if (error) throw error;

        await persistRateio(lancamento.id, tipo);
        toast.success("Lançamento atualizado");
      } else {
        const rows = Array.from({ length: numParcelas }, (_, i) => {
          const dataParcela = addMonths(data.dataVencimento, i);
          const dataStr = format(dataParcela, "yyyy-MM-dd");
          const isUltima = i === numParcelas - 1 && numParcelas > 1;
          const valorFinal = isUltima
            ? Math.round((valorNum - valorParcela * (numParcelas - 1)) * 100) / 100
            : valorParcela;
          const desc = numParcelas > 1 ? `${data.descricao} (${i + 1}/${numParcelas})` : data.descricao;
          return isReceita
            ? {
                data_vencimento: dataStr,
                data_recebimento: data.status === "Recebida" ? dataStr : null,
                data_competencia: dataCompetenciaStr,
                descricao: desc,
                valor: valorFinal,
                status: data.status === "Recebida" ? "Recebido" : "Pendente",
                forma_pagamento: data.formaPagamento || null,
                categoria_id: data.categoriaId || null,
                projeto_id: data.projetoId || null,
                conta_id: data.contaId || null,
                cliente_id: data.clienteId || null,
                centro_custo_id: data.centroCustoId || null,
                nota_fiscal: data.notaFiscal || null,
                observacao: data.observacao || null,
                empresa_id: empresaId,
                grupo_parcela: grupoParcela,
                parcela_numero: numParcelas > 1 ? i + 1 : null,
                parcela_total: numParcelas > 1 ? numParcelas : null,
              }
            : {
                data_vencimento: dataStr,
                data_pagamento: data.status === "Pago" ? dataStr : null,
                data_competencia: dataCompetenciaStr,
                descricao: desc,
                valor: valorFinal,
                status: data.status,
                forma_pagamento: data.formaPagamento || null,
                categoria_id: data.categoriaId || null,
                projeto_id: data.projetoId || null,
                conta_id: data.contaId || null,
                cartao_id: data.cartaoId || null,
                fornecedor_id: data.fornecedorId || null,
                centro_custo_id: data.centroCustoId || null,
                nota_fiscal: data.notaFiscal || null,
                observacao: data.observacao || null,
                empresa_id: empresaId,
                grupo_parcela: grupoParcela,
                parcela_numero: numParcelas > 1 ? i + 1 : null,
                parcela_total: numParcelas > 1 ? numParcelas : null,
              };
        });
        const { data: inserted, error } = await supabase
          .from(table)
          .insert(rows as never)
          .select("id");
        if (error) throw error;

        if (rateioOn && rateios.length > 0 && inserted) {
          for (const row of inserted as Array<{ id: string }>) {
            await persistRateio(row.id, tipo);
          }
        }

        toast.success(isReceita ? "Receita cadastrada" : "Despesa cadastrada", {
          description: `${numParcelas} registro(s) criado(s)`,
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = form.handleSubmit(async (data) => {
    if (isEdit) {
      await save(data);
      return;
    }
    const valorNum = parseCurrencyString(data.valorTotal);
    const numParcelas = parseInt(data.parcelas || "1") || 1;
    const found = await checkDuplicates({
      table: isReceita ? "receitas" : "despesas",
      descricao: data.descricao,
      valor: valorNum / numParcelas,
      dataVencimento: data.dataVencimento,
    });
    if (found.length > 0) {
      setDuplicates(found);
      setPendingData(data);
      setShowDupWarning(true);
      return;
    }
    await save(data);
  });

  const clienteId = form.watch("clienteId");
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
        className={cn("tabular-nums", ok ? "bg-positive/10 text-positive" : "bg-amber-100 text-amber-700")}
      >
        Soma: {soma.toFixed(2)}%
      </Badge>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>
                {isEdit ? "Editar" : "Novo"} {isReceita ? "Receita" : "Despesa"}
              </DialogTitle>
              <DialogDescription>
                {isEdit ? "Altere os campos e salve" : "Campos obrigatórios marcados com *"}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={onSubmit} className="divide-y">
            {/* Linha principal */}
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Coluna esquerda — obrigatórios */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dados principais
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição *</Label>
                  <Input {...form.register("descricao")} placeholder="Ex: Honorários projeto A" className="h-9" />
                  {form.formState.errors.descricao && (
                    <p className="text-xs text-red-500">{form.formState.errors.descricao.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor total (R$) *</Label>
                    <Input
                      value={form.watch("valorTotal")}
                      onChange={(e) => form.setValue("valorTotal", formatCurrencyInput(e.target.value))}
                      placeholder="R$ 0,00"
                      className="h-9 tabular-nums"
                    />
                    {form.formState.errors.valorTotal && (
                      <p className="text-xs text-red-500">{form.formState.errors.valorTotal.message}</p>
                    )}
                  </div>
                  {!isEdit && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Parcelas</Label>
                      <Input type="number" min="1" {...form.register("parcelas")} className="h-9" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vencimento *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-9 justify-start text-xs font-normal",
                            !form.watch("dataVencimento") && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3 w-3" />
                          {form.watch("dataVencimento")
                            ? format(form.watch("dataVencimento"), "dd/MM/yyyy")
                            : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.watch("dataVencimento")}
                          onSelect={(d) => d && form.setValue("dataVencimento", d)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
                  <Select
                    value={form.watch("formaPagamento")}
                    onValueChange={(v) => form.setValue("formaPagamento", v)}
                  >
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vínculos</p>

                {isReceita ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cliente (pagante)</Label>
                    <Select value={form.watch("clienteId")} onValueChange={(v) => form.setValue("clienteId", v)}>
                      <SelectTrigger className="h-9">
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
                            <QrCode className="h-3 w-3 shrink-0 text-brand" />
                            <span className="font-medium">{c.chave}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto">
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
                  <Select value={form.watch("projetoId")} onValueChange={(v) => form.setValue("projetoId", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {aux.projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={form.watch("categoriaId")} onValueChange={(v) => form.setValue("categoriaId", v)}>
                    <SelectTrigger className="h-9">
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

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Conta
                    {(form.watch("status") === "Recebida" || form.watch("status") === "Pago") && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </Label>
                  <Select value={form.watch("contaId")} onValueChange={(v) => form.setValue("contaId", v)}>
                    <SelectTrigger className={cn("h-9", form.formState.errors.contaId && "border-red-500")}>
                      <SelectValue placeholder="Selecione" />
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
                    <p className="text-xs text-red-500">{form.formState.errors.contaId.message}</p>
                  )}
                </div>

                {!isReceita && aux.cartoes.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cartão de crédito</Label>
                    <Select value={form.watch("cartaoId")} onValueChange={(v) => form.setValue("cartaoId", v)}>
                      <SelectTrigger className={cn("h-9", form.formState.errors.cartaoId && "border-red-500")}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {aux.cartoes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.cartaoId && (
                      <p className="text-xs text-red-500">{form.formState.errors.cartaoId.message}</p>
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
                  className="w-full flex items-center justify-between px-6 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-gray-50/50 transition-colors"
                >
                  <span className="font-medium uppercase tracking-wider">Mais opções</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de competência</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-9 justify-start text-xs font-normal",
                            !form.watch("dataCompetencia") && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3 w-3" />
                          {form.watch("dataCompetencia")
                            ? format(form.watch("dataCompetencia") as Date, "dd/MM/yyyy")
                            : "Igual ao vencimento"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.watch("dataCompetencia")}
                          onSelect={(d) => form.setValue("dataCompetencia", d)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center justify-between">
                      Centro de custo
                      <button
                        type="button"
                        className="text-[10px] text-brand hover:underline inline-flex items-center gap-0.5"
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
                          "text-[10px] px-2 py-0.5 rounded border",
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
                                  setRateios((prev) =>
                                    prev.map((p, idx) => (idx === i ? { ...p, centro_custo_id: v } : p))
                                  )
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
                                className="h-7 w-7 text-red-600"
                                onClick={() => setRateios((prev) => prev.filter((_, idx) => idx !== i))}
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
                    <Label className="text-xs">Nota fiscal</Label>
                    <Select value={form.watch("notaFiscal")} onValueChange={(v) => form.setValue("notaFiscal", v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Observação</Label>
                    <Input {...form.register("observacao")} placeholder="Observações adicionais" className="h-9" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50/30">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-brand hover:bg-brand/90 text-ink" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : isEdit ? (
                  "Atualizar"
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CentroCustoManager
        open={ccManagerOpen}
        onOpenChange={setCcManagerOpen}
        onChanged={() => {
          /* aux refreshes on next open of form */
        }}
      />

      <DuplicateWarningDialog
        open={showDupWarning}
        onOpenChange={(v) => {
          setShowDupWarning(v);
          if (!v) setPendingData(null);
        }}
        duplicates={duplicates}
        onConfirm={() => {
          setShowDupWarning(false);
          if (pendingData) {
            save(pendingData);
            setPendingData(null);
          }
        }}
      />
    </>
  );
}
