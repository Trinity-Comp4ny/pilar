import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { despesaSchema, despesaDefaultValues, type DespesaFormData } from "@/schemas/despesaSchema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Check, DollarSign, Plus, Settings, Pencil, Tag, Trash2, Loader2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "../components/CategoryManager";
import { SupplierManager } from "../components/SupplierManager";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { formatCurrencyInput, formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { checkDuplicates, type DuplicateMatch } from "@/lib/duplicateCheck";
import { DuplicateWarningDialog } from "@/components/DuplicateWarningDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DespesaDetailDialog } from "./DespesaDetailDialog";

/**
 * Função para obter a data de exibição correta baseada no status para despesas
 */
const getDespesaDisplayDate = (despesa: Despesa): string => {
  const displayDate = getDisplayDate(despesa.data_pagamento, despesa.data_vencimento, despesa.status);
  return formatDateDisplay(displayDate);
};

interface Despesa {
  id: string;
  data_vencimento: string;
  data_pagamento?: string;
  descricao: string;
  categoria_id: string | null;
  categoria_nome?: string | null;
  valor: number;
  status: string;
  projeto_id: string | null;
  projeto_codigo?: string | null;
  nota_fiscal: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  observacao: string | null;
  fornecedor_id: string | null;
  fornecedor_nome?: string | null;
  forma_pagamento?: string | null;
  created_by?: string; // user uuid
  grupo_parcela?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
}

export default function Despesas() {
  const [despesasRaw, setDespesasRaw] = useState<Despesa[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [cartoes, setCartoes] = useState<{ id: string; nome: string; tipo: string; dia_fechamento: number | null }[]>(
    []
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);

  const { canEdit } = useFeatureAccess("financeiro");

  const form = useForm<DespesaFormData>({
    resolver: zodResolver(despesaSchema),
    defaultValues: despesaDefaultValues,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const [categorias, setCategorias] = useState<{ id: string; name: string }[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; name: string }[]>([]);
  const [projetos, setProjetos] = useState<{ id: string; projetoID: string | null }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [
        { data: categoriasData },
        { data: fornecedoresData },
        { data: contasData },
        { data: cartoesData },
        { data: projetosData },
        { data: despesasData, error: _despesasError },
      ] = await Promise.all([
        supabase.from("categorias_financeiras").select("id, nome").eq("tipo", "Despesa").order("nome"),
        supabase.from("fornecedores").select("id, nome").order("nome"),
        supabase.from("contas").select("id, nome"),
        supabase.from("cartoes").select("id, nome, tipo, dia_fechamento"),
        supabase.from("projetos").select("id, nome, codigo_projeto").order("nome"),
        supabase
          .from("despesas")
          .select(
            `
          *,
          projetos (codigo_projeto),
          fornecedores (nome)
        `
          )
          .eq("is_fatura_payment", false)
          .is("deleted_at", null)
          .order("data_pagamento", { ascending: false })
          .order("data_vencimento", { ascending: false }),
      ]);

      if (categoriasData) setCategorias(categoriasData.map((c) => ({ id: c.id, name: c.nome })));
      if (fornecedoresData) setFornecedores(fornecedoresData.map((s) => ({ id: s.id, name: s.nome })));
      if (contasData) setContas(contasData);
      if (cartoesData) setCartoes(cartoesData);
      if (projetosData) setProjetos(projetosData.map((p) => ({ id: p.id, projetoID: p.codigo_projeto })));
      if (despesasData) {
        setDespesasRaw(despesasData as unknown as Despesa[]);
      }
    } catch {
      toast.error("Erro ao carregar dados", { description: "Não foi possível carregar as informações financeiras." });
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const despesas = useMemo(() => {
    return despesasRaw.map((d) => {
      // Derive payment method
      let forma = "-";
      if (d.cartao_id) {
        const cartao = cartoes.find((c) => c.id === d.cartao_id);
        forma = cartao?.tipo === "debito" ? "Cartão de Débito" : "Cartão de Crédito";
      } else if (d.conta_id) forma = "Conta/Outro";

      return {
        ...d,
        categoria_nome: categorias.find((c) => c.id === d.categoria_id)?.name || d.categoria_id,
        data_pagamento: d.data_pagamento || d.data_vencimento,
        projeto_codigo: (d as Despesa & { projetos?: { codigo_projeto?: string } }).projetos?.codigo_projeto,
        fornecedor_nome: (d as Despesa & { fornecedores?: { nome?: string } }).fornecedores?.nome,
        forma_pagamento: forma,
      };
    });
  }, [despesasRaw, categorias]);

  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      const matchSearch =
        !searchTerm ||
        d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.fornecedor_nome || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus =
        statusFilter === "todos" ||
        (statusFilter === "pago" && d.status === "Pago") ||
        (statusFilter === "pendente" && d.status === "Pendente") ||
        (statusFilter === "atrasado" && d.status === "Atrasado");
      return matchSearch && matchStatus;
    });
  }, [despesas, searchTerm, statusFilter]);

  const handleCategoryChange = () => {
    fetchData();
  };

  const handleSupplierChange = () => {
    fetchData();
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formattedValue = formatCurrencyInput(inputValue);
    form.setValue("valorTotal", formattedValue);
  };

  const openEditDespesa = (despesa: Despesa) => {
    setSelectedDespesa(despesa);

    // Derivar forma de pagamento pelo vínculo existente
    const cartaoEncontrado = cartoes.find((c) => c.id === despesa.cartao_id);
    const formaPgto = despesa.cartao_id
      ? cartaoEncontrado?.tipo === "debito"
        ? "Cartão de Débito"
        : "Cartão de Crédito"
      : "";

    form.reset({
      dataVencimento: despesa.data_vencimento ? new Date(despesa.data_vencimento) : new Date(),
      descricao: despesa.descricao,
      valorTotal: formatValorToInput(despesa.valor),
      status: despesa.status as "Pago" | "Pendente",
      categoriaId: despesa.categoria_id || "",
      projetoID: despesa.projeto_id || "",
      notaFiscal: despesa.nota_fiscal || "",
      contaId: despesa.conta_id || "",
      cartaoId: despesa.cartao_id || "",
      observacao: despesa.observacao || "",
      fornecedorId: despesa.fornecedor_id || "",
      parcelas: "1",
      formaPagamento: formaPgto,
      recorrente: (despesa as Despesa & { recorrente?: boolean }).recorrente || false,
      periodicidade: (despesa as Despesa & { periodicidade?: string }).periodicidade || "mensal",
    });

    setIsDetailOpen(false);
    setIsDialogOpen(true);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<DespesaFormData | null>(null);

  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (isDialogOpen) setStep(1);
  }, [isDialogOpen]);

  const goNext = async () => {
    const valid = await form.trigger(["descricao", "valorTotal", "dataVencimento"]);
    if (!valid) return;
    setStep(2);
  };

  const goBack = () => setStep(1);

  const saveDespesa = async (formData: DespesaFormData) => {
    setIsSaving(true);
    try {
      const numParcelas = parseInt(formData.parcelas) || 1;
      const valorNumerico = parseCurrencyString(formData.valorTotal);
      const valorParcela = Math.round((valorNumerico / numParcelas) * 100) / 100;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado");

      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      const grupoParcela = numParcelas > 1 ? crypto.randomUUID() : null;
      const despesasToInsert = [];

      // Data base para parcelas — mantém a data original da compra.
      // O mês de billing correto é calculado ao chamar gerar_fatura.
      const initialDate = new Date(formData.dataVencimento);

      for (let i = 0; i < numParcelas; i++) {
        const dataParcela = addMonths(initialDate, i);
        const dataStr = format(dataParcela, "yyyy-MM-dd");
        const isUltimaParcela = i === numParcelas - 1 && numParcelas > 1;
        const valorFinal = isUltimaParcela
          ? Math.round((valorNumerico - valorParcela * (numParcelas - 1)) * 100) / 100
          : valorParcela;

        despesasToInsert.push({
          data_vencimento: dataStr,
          data_pagamento: formData.status === "Pago" ? dataStr : null,
          descricao: numParcelas > 1 ? `${formData.descricao} (${i + 1}/${numParcelas})` : formData.descricao,
          categoria_id: formData.categoriaId || null,
          valor: valorFinal,
          fornecedor_id: formData.fornecedorId || null,
          projeto_id: formData.projetoID || null,
          nota_fiscal: formData.notaFiscal || null,
          status: formData.status === "Pago" ? "Pago" : "Pendente",
          conta_id: formData.contaId || null,
          cartao_id: formData.cartaoId || null,
          observacao: formData.observacao || null,
          recorrente: formData.recorrente || false,
          periodicidade: formData.recorrente ? formData.periodicidade || "mensal" : null,
          empresa_id: empresaId!,
          grupo_parcela: selectedDespesa ? (selectedDespesa.grupo_parcela ?? null) : grupoParcela,
          parcela_numero: selectedDespesa ? (selectedDespesa.parcela_numero ?? null) : numParcelas > 1 ? i + 1 : null,
          parcela_total: selectedDespesa
            ? (selectedDespesa.parcela_total ?? null)
            : numParcelas > 1
              ? numParcelas
              : null,
        });
      }

      let error = null;

      if (selectedDespesa) {
        const dataChanged = despesasToInsert[0].data_vencimento !== selectedDespesa.data_vencimento;
        const updatePayload =
          dataChanged && selectedDespesa.cartao_id ? { ...despesasToInsert[0], fatura_id: null } : despesasToInsert[0];
        ({ error } = await supabase
          .from("despesas")
          .update(updatePayload as Record<string, unknown> as never)
          .eq("id", selectedDespesa.id));
      } else {
        ({ error } = await supabase.from("despesas").insert(despesasToInsert as never[]));
      }

      if (error) throw error;

      // Associar despesas de cartão às faturas correspondentes.
      // O mês de billing é calculado com base no dia de fechamento do cartão:
      // compras após o fechamento pertencem à fatura do mês seguinte.
      if (formData.cartaoId) {
        const card = cartoes.find((c) => c.id === formData.cartaoId);
        const diaFechamento = card?.dia_fechamento ?? 31;
        const mesesGerados = new Set<string>();

        for (const d of despesasToInsert) {
          const dt = new Date(d.data_vencimento + "T00:00:00");
          let billingMonth = dt.getMonth() + 1;
          let billingYear = dt.getFullYear();

          if (dt.getDate() > diaFechamento) {
            billingMonth++;
            if (billingMonth > 12) {
              billingMonth = 1;
              billingYear++;
            }
          }

          const key = `${billingMonth}-${billingYear}`;
          if (!mesesGerados.has(key)) {
            mesesGerados.add(key);
            const { error: faturaError } = await supabase.rpc("gerar_fatura", {
              p_cartao_id: formData.cartaoId,
              p_mes: billingMonth,
              p_ano: billingYear,
            });
            if (faturaError) {
              toast.error("Erro ao associar fatura do cartão", { description: faturaError.message });
            }
          }
        }
      }

      toast.success(selectedDespesa ? "Despesa atualizada" : "Despesa cadastrada", {
        description: selectedDespesa
          ? "1 registro atualizado com sucesso"
          : `${numParcelas} registro(s) criado(s) com sucesso`,
      });

      setIsDialogOpen(false);
      fetchData();
      resetForm();
    } catch (err: unknown) {
      toast.error("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (formData) => {
    if (selectedDespesa) {
      await saveDespesa(formData);
      return;
    }

    setIsSaving(true);
    try {
      const valorNumerico = parseCurrencyString(formData.valorTotal);
      const numParcelas = parseInt(formData.parcelas) || 1;
      const valorParcela = valorNumerico / numParcelas;

      const found = await checkDuplicates({
        table: "despesas",
        descricao: formData.descricao,
        valor: valorParcela,
        dataVencimento: formData.dataVencimento,
      });

      if (found.length > 0) {
        setDuplicates(found);
        setPendingFormData(formData);
        setShowDuplicateWarning(true);
        setIsSaving(false);
        return;
      }
    } catch {
      toast.error("Erro ao excluir despesa");
    } finally {
      if (!showDuplicateWarning) setIsSaving(false);
    }

    await saveDespesa(formData);
  });

  const resetForm = () => {
    form.reset(despesaDefaultValues);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; grupoId: string; label: string } | null>(
    null
  );

  const handleDelete = (id: string) => {
    const despesa = despesasRaw.find((d) => d.id === id);
    if (despesa?.grupo_parcela) {
      const total =
        despesa.parcela_total ?? despesasRaw.filter((d) => d.grupo_parcela === despesa.grupo_parcela).length;
      setDeleteGroupTarget({
        id,
        grupoId: despesa.grupo_parcela,
        label: `parcela ${despesa.parcela_numero ?? "?"} de ${total}`,
      });
    } else {
      setDeleteId(id);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      const { error } = await supabase.from("despesas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Despesa excluída");
      await fetchData();
    } catch (err) {
      toast.error("Falha ao excluir despesa", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    }
  };

  const confirmDeleteGroup = async (mode: "single" | "all") => {
    if (!deleteGroupTarget) return;
    const { id, grupoId } = deleteGroupTarget;
    setDeleteGroupTarget(null);
    setIsDetailOpen(false);
    const now = new Date().toISOString();
    try {
      if (mode === "all") {
        const { error } = await supabase
          .from("despesas")
          .update({ deleted_at: now })
          .eq("grupo_parcela", grupoId)
          .is("deleted_at", null);
        if (error) throw error;
        toast.success("Grupo de parcelas excluído");
      } else {
        const { error } = await supabase.from("despesas").update({ deleted_at: now }).eq("id", id);
        if (error) throw error;
        toast.success("Parcela excluída");
      }
      await fetchData();
    } catch (err) {
      toast.error("Falha ao excluir", { description: err instanceof Error ? err.message : "Tente novamente" });
    }
  };

  return (
    <div className="space-y-8 w-full max-w-none">
      <Card className="rounded-2xl border border-black/10 bg-white p-6 w-full">
        <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium tracking-tight">Lista de Despesas</CardTitle>
            <CardDescription className="text-sm text-black/60 mt-1">
              Total de {despesas.length} despesa(s) cadastrada(s)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Configurações de Despesas</DialogTitle>
                  <DialogDescription>Gerencie as categorias de despesas e fornecedores</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="categorias" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="categorias">Categorias</TabsTrigger>
                    <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
                  </TabsList>
                  <TabsContent value="categorias" className="mt-4">
                    <CategoryManager
                      title="Categorias de Despesas"
                      description="Gerencie as categorias disponíveis para classificar despesas"
                      type="Despesa"
                      onCategoryChange={handleCategoryChange}
                    />
                  </TabsContent>
                  <TabsContent value="fornecedores" className="mt-4">
                    <SupplierManager onSupplierChange={handleSupplierChange} />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              {canEdit && (
                <DialogTrigger asChild>
                  <Button className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Despesa
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
                <div className="px-6 pt-6 pb-4 border-b">
                  <DialogHeader>
                    <DialogTitle>{selectedDespesa ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                    <DialogDescription>
                      {step === 1 ? "Valor, data e forma de pagamento" : "Conta, vínculos e recorrência"}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Stepper */}
                <div className="px-6 py-3 border-b">
                  <div className="flex items-center gap-1">
                    {[
                      { id: 1 as const, label: "Identificação", icon: DollarSign },
                      { id: 2 as const, label: "Classificação", icon: Tag },
                    ].map((s, i) => {
                      const Icon = s.icon;
                      const isActive = step === s.id;
                      const isCompleted = step > s.id;
                      const isClickable = !!selectedDespesa || s.id <= step;
                      return (
                        <div key={s.id} className="flex items-center flex-1">
                          <button
                            type="button"
                            onClick={() => isClickable && setStep(s.id)}
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
                          {i < 1 && <div className={cn("h-px flex-1 mx-1", step > s.id ? "bg-brand" : "bg-muted")} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (step === 2) handleSubmit(e);
                  }}
                  className="divide-y"
                >
                  {/* STEP 1 — Identificação */}
                  {step === 1 && (
                    <>
                      {selectedDespesa?.grupo_parcela && (
                        <div className="px-6 pt-4 pb-0">
                          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <span className="font-medium">
                              Parcela {selectedDespesa.parcela_numero ?? "?"} de {selectedDespesa.parcela_total ?? "?"}
                            </span>
                            <span className="text-amber-600">
                              — faz parte de um grupo. Editar aqui altera só esta parcela.
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Descrição */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Descrição</Label>
                        <div>
                          <Input
                            id="descricao"
                            {...form.register("descricao")}
                            placeholder="Ex: Material de escritório, Aluguel"
                          />
                          {form.formState.errors.descricao && (
                            <p className="text-xs text-red-500 mt-1">{form.formState.errors.descricao.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Financeiro */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                          Dados Financeiros
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="valorTotal" className="text-xs">
                              Valor (R$) *
                            </Label>
                            <Input
                              id="valorTotal"
                              type="text"
                              value={form.watch("valorTotal")}
                              onChange={handleValorChange}
                              placeholder="R$ 0,00"
                              className="h-9"
                            />
                            {form.formState.errors.valorTotal && (
                              <p className="text-xs text-red-500 mt-1">{form.formState.errors.valorTotal.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="parcelas" className="text-xs">
                              Parcelas
                            </Label>
                            <Input
                              id="parcelas"
                              type="number"
                              min="1"
                              {...form.register("parcelas")}
                              placeholder="1"
                              className="h-9"
                              disabled={!!selectedDespesa}
                            />
                            {selectedDespesa && (
                              <p className="text-xs text-muted-foreground">Editando parcela individual</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="status" className="text-xs">
                              Status
                            </Label>
                            <Select
                              value={form.watch("status")}
                              onValueChange={(v) => form.setValue("status", v as "Pago" | "Pendente")}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pago">Pago</SelectItem>
                                <SelectItem value="Pendente">Pendente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="formaPagamento" className="text-xs">
                              Forma Pgto.
                            </Label>
                            <Select
                              value={form.watch("formaPagamento")}
                              onValueChange={(v) => form.setValue("formaPagamento", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                                <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                                <SelectItem value="PIX">PIX</SelectItem>
                                <SelectItem value="Transferência">Transferência</SelectItem>
                                <SelectItem value="Boleto">Boleto</SelectItem>
                                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Vencimento */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Vencimento</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Data Vencimento *</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal text-xs h-9",
                                    !form.watch("dataVencimento") && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {form.watch("dataVencimento")
                                    ? format(form.watch("dataVencimento"), "dd/MM/yyyy")
                                    : "Selecionar"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={form.watch("dataVencimento")}
                                  onSelect={(d) => form.setValue("dataVencimento", d as Date)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          {!selectedDespesa && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Parcelas</Label>
                              <Input type="number" min={1} max={60} className="h-9" {...form.register("parcelas")} />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* STEP 2 — Classificação */}
                  {step === 2 && (
                    <>
                      {/* Pagamento */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                          Conta / Cartão
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {form.watch("formaPagamento") === "Cartão de Crédito" ||
                          form.watch("formaPagamento") === "Cartão de Débito" ? (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Cartão</Label>
                              <Select
                                value={form.watch("cartaoId")}
                                onValueChange={(v) => form.setValue("cartaoId", v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Selecione o cartão" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cartoes.map((cartao) => (
                                    <SelectItem key={cartao.id} value={cartao.id}>
                                      {cartao.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Conta de Saída</Label>
                              <Select value={form.watch("contaId")} onValueChange={(v) => form.setValue("contaId", v)}>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Selecione a conta" />
                                </SelectTrigger>
                                <SelectContent>
                                  {contas.map((conta) => (
                                    <SelectItem key={conta.id} value={conta.id}>
                                      {conta.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nota Fiscal</Label>
                            <Select
                              value={form.watch("notaFiscal")}
                              onValueChange={(v) => form.setValue("notaFiscal", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Sim">Sim</SelectItem>
                                <SelectItem value="Não">Não</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Vínculos */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Vínculos</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Fornecedor</Label>
                            <Select
                              value={form.watch("fornecedorId")}
                              onValueChange={(v) => form.setValue("fornecedorId", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {fornecedores.map((forn) => (
                                  <SelectItem key={forn.id} value={forn.id}>
                                    {forn.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Projeto</Label>
                            <Select
                              value={form.watch("projetoID")}
                              onValueChange={(v) => form.setValue("projetoID", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {projetos.map((proj) => (
                                  <SelectItem key={proj.id} value={proj.id}>
                                    {proj.projetoID}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Categoria</Label>
                            <Select
                              value={form.watch("categoriaId")}
                              onValueChange={(v) => form.setValue("categoriaId", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {categorias.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Observação */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Observação</Label>
                        <Input id="observacao" {...form.register("observacao")} placeholder="Observações adicionais" />
                      </div>

                      {/* Recorrência */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                          Recorrência
                        </Label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              {...form.register("recorrente")}
                            />
                            Despesa recorrente
                          </label>
                          {form.watch("recorrente") && (
                            <select
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                              {...form.register("periodicidade")}
                            >
                              <option value="mensal">Mensal</option>
                              <option value="trimestral">Trimestral</option>
                              <option value="semestral">Semestral</option>
                              <option value="anual">Anual</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-2 px-6 py-4 bg-gray-50/30">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <div className="flex-1" />
                    {step === 2 && (
                      <Button type="button" variant="outline" onClick={goBack} disabled={isSaving}>
                        Voltar
                      </Button>
                    )}
                    {step === 1 ? (
                      <Button type="button" onClick={goNext} className="bg-brand hover:bg-brand/90 text-ink">
                        Próximo →
                      </Button>
                    ) : (
                      <Button type="submit" className="bg-brand hover:bg-brand/90 text-ink" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                          </>
                        ) : selectedDespesa ? (
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filtros */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50/50">
            <Input
              placeholder="Buscar por descrição ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 max-w-xs text-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {despesasFiltradas.length} de {despesasRaw.length}
            </span>
          </div>
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data (Venc/Pag)</TableHead>{" "}
                  {/* Mais claro: mostra vencimento para pendentes, pagamento para pagos */}
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Forma Pag.</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nota Fiscal</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesasFiltradas.map((despesa) => (
                  <TableRow
                    key={despesa.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      setSelectedDespesa(despesa);
                      setIsDetailOpen(true);
                    }}
                  >
                    <TableCell>{getDespesaDisplayDate(despesa)}</TableCell>
                    <TableCell className="font-medium">{despesa.descricao}</TableCell>
                    <TableCell>{despesa.fornecedor_nome || "-"}</TableCell>
                    <TableCell>{despesa.projeto_codigo || "-"}</TableCell>
                    <TableCell>{despesa.categoria_nome || "-"}</TableCell>
                    <TableCell>{despesa.forma_pagamento}</TableCell>
                    <TableCell>
                      {despesa.parcela_numero && despesa.parcela_total
                        ? `${despesa.parcela_numero}/${despesa.parcela_total}`
                        : "1/1"}
                    </TableCell>
                    <TableCell className="text-red-600 font-medium">
                      R$ {despesa.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={despesa.status === "Pago" ? "default" : "secondary"}
                        className={despesa.status === "Pago" ? "bg-positive/100" : ""}
                      >
                        {despesa.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={despesa.nota_fiscal === "Sim" ? "default" : "outline"}
                        className={despesa.nota_fiscal === "Sim" ? "bg-positive/100" : ""}
                      >
                        {despesa.nota_fiscal || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => openEditDespesa(despesa)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(despesa.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DespesaDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        despesa={selectedDespesa as never}
        contas={contas}
        cartoes={cartoes.map((c) => ({ ...c, dia_fechamento: c.dia_fechamento ?? undefined }))}
        canEdit={canEdit}
        onEdit={openEditDespesa as never}
        onDelete={handleDelete}
      />

      <DuplicateWarningDialog
        open={showDuplicateWarning}
        onOpenChange={(open) => {
          setShowDuplicateWarning(open);
          if (!open) setPendingFormData(null);
        }}
        duplicates={duplicates}
        onConfirm={() => {
          setShowDuplicateWarning(false);
          if (pendingFormData) {
            saveDespesa(pendingFormData);
            setPendingFormData(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null);
        }}
        onConfirm={confirmDelete}
        title="Excluir despesa?"
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="destructive"
      />

      <AlertDialog
        open={!!deleteGroupTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteGroupTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir parcela do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta é a {deleteGroupTarget?.label}. Deseja excluir apenas esta parcela ou todas as parcelas do grupo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => confirmDeleteGroup("single")}
            >
              Só esta parcela
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDeleteGroup("all")}
            >
              Todo o grupo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
