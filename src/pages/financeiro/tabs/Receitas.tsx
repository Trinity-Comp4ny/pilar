import { useState, useEffect, useMemo } from "react";
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
import { CalendarIcon, Plus, Settings, Pencil, Trash2, Loader2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "../components/CategoryManager";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { formatCurrencyInput, formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { receitaSchema, receitaDefaultValues, type ReceitaFormData } from "@/schemas/receitaSchema";
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
import { AsaasCobrancaButton } from "@/components/asaas/AsaasCobrancaButton";
import { AsaasConfigForm } from "@/components/asaas/AsaasConfigForm";
import { CobrarPorEmailButton } from "@/components/CobrarPorEmailButton";

/**
 * Função para obter a data de exibição correta baseada no status
 */
const getReceitaDisplayDate = (receita: Receita): string => {
  const displayDate = getDisplayDate(receita.data_recebimento, receita.data_vencimento, receita.status);
  return formatDateDisplay(displayDate);
};

interface Receita {
  id: string;
  data_vencimento: string;
  data_recebimento?: string;
  descricao: string;
  projeto_id: string | null;
  categoria_id: string | null;
  categoria_nome?: string;
  valor: number;
  forma_pagamento: string | null;
  nota_fiscal: string | null;
  status: string;
  conta_id: string | null;
  cliente_id: string | null;
  observacao: string | null;
  cliente_nome?: string;
  projeto_codigo?: string;
  parcelas?: string;
  grupo_parcela?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  asaas_payment_id?: string | null;
  asaas_payment_url?: string | null;
  asaas_payment_status?: string | null;
  asaas_billing_type?: string | null;
}

export default function Receitas() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedReceita, setSelectedReceita] = useState<Receita | null>(null);

  const { canEdit } = useFeatureAccess("financeiro");

  const form = useForm<ReceitaFormData>({
    resolver: zodResolver(receitaSchema),
    defaultValues: receitaDefaultValues,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const [categorias, setCategorias] = useState<{ id: string; name: string }[]>([]);
  const [projetos, setProjetos] = useState<{ id: string; projetoID: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);

  const receitasFiltradas = useMemo(() => {
    return receitas.filter((r) => {
      const matchSearch =
        !searchTerm ||
        r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.cliente_nome || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus =
        statusFilter === "todos" ||
        (statusFilter === "recebido" && r.status === "Recebido") ||
        (statusFilter === "pendente" && r.status === "Pendente") ||
        (statusFilter === "atrasado" && r.status === "Atrasado");
      return matchSearch && matchStatus;
    });
  }, [receitas, searchTerm, statusFilter]);

  const fetchAuxiliaryData = async () => {
    // Fetch Categorias
    const { data: categoriasData } = await supabase
      .from("categorias_financeiras")
      .select("*")
      .eq("tipo", "Receita")
      .order("nome");

    setCategorias((categoriasData ?? []).map((cat) => ({ id: cat.id, name: cat.nome })));

    // Fetch Clientes
    const { data: clientesData } = await supabase.from("clientes").select("*").order("nome");

    setClientes((clientesData ?? []).map((c) => ({ id: c.id, nome: c.nome })));

    // Fetch Contas
    const { data: contasData } = await supabase.from("contas").select("*").order("nome");

    setContas((contasData ?? []).map((c) => ({ id: c.id, nome: c.nome })));

    // Fetch Projetos
    const { data: projetosData } = await supabase.from("projetos").select("id, nome, codigo_projeto").order("nome");

    setProjetos((projetosData ?? []).map((p) => ({ id: p.id, projetoID: p.codigo_projeto ?? "" })));
  };

  // Fetch Initial Data
  useEffect(() => {
    fetchReceitas();
    fetchAuxiliaryData();
  }, []);

  const fetchReceitas = async () => {
    const { data, error } = await supabase
      .from("receitas")
      .select(
        `
        *,
        categorias_financeiras (nome),
        clientes (nome),
        projetos (codigo_projeto)
      `
      )
      .is("deleted_at", null)
      .order("data_recebimento", { ascending: false })
      .order("data_vencimento", { ascending: false });

    if (error) {
      // Error will be visible through empty data state
    }

    const formattedData = (data ?? []).map((d) => ({
      ...d,
      categoria_nome: d.categorias_financeiras?.nome,
      cliente_nome: d.clientes?.nome,
      projeto_codigo: d.projetos?.codigo_projeto,
      data_recebimento: d.data_recebimento || d.data_vencimento,
    }));
    setReceitas(formattedData as unknown as Receita[]);
  };

  const handleCategoryChange = () => {
    fetchAuxiliaryData();
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formattedValue = formatCurrencyInput(inputValue);
    form.setValue("valorTotal", formattedValue);
  };

  const openEditReceita = (receita: Receita) => {
    setSelectedReceita(receita);

    form.reset({
      dataVencimento: receita.data_vencimento ? new Date(receita.data_vencimento) : new Date(),
      descricao: receita.descricao,
      valorTotal: formatValorToInput(receita.valor),
      status: receita.status === "Recebido" ? "Recebida" : "Pendente",
      categoriaId: receita.categoria_id || "",
      projetoID: receita.projeto_id || "",
      notaFiscal: receita.nota_fiscal || "",
      contaId: receita.conta_id || "",
      clienteId: receita.cliente_id || "",
      observacao: receita.observacao || "",
      formaPagamento: receita.forma_pagamento || "",
      parcelas: "1",
      recorrencia: "Nenhuma",
    });

    setIsDetailOpen(false);
    setIsDialogOpen(true);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ReceitaFormData | null>(null);

  const saveReceita = async (formData: ReceitaFormData) => {
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
      const receitasToInsert = [];

      for (let i = 0; i < numParcelas; i++) {
        const dataParcela = addMonths(formData.dataVencimento, i);
        const dataStr = format(dataParcela, "yyyy-MM-dd");
        const isUltimaParcela = i === numParcelas - 1 && numParcelas > 1;
        const valorFinal = isUltimaParcela
          ? Math.round((valorNumerico - valorParcela * (numParcelas - 1)) * 100) / 100
          : valorParcela;

        receitasToInsert.push({
          data_vencimento: dataStr,
          data_recebimento: formData.status === "Recebida" ? dataStr : null,
          descricao: numParcelas > 1 ? `${formData.descricao} (${i + 1}/${numParcelas})` : formData.descricao,
          projeto_id: formData.projetoID || null,
          categoria_id: formData.categoriaId || null,
          valor: valorFinal,
          forma_pagamento: formData.formaPagamento || null,
          nota_fiscal: formData.notaFiscal || null,
          status: formData.status === "Recebida" ? "Recebido" : "Pendente",
          conta_id: formData.contaId || null,
          cliente_id: formData.clienteId || null,
          observacao: formData.observacao || null,
          empresa_id: empresaId,
          grupo_parcela: selectedReceita ? (selectedReceita.grupo_parcela ?? null) : grupoParcela,
          parcela_numero: selectedReceita ? (selectedReceita.parcela_numero ?? null) : numParcelas > 1 ? i + 1 : null,
          parcela_total: selectedReceita
            ? (selectedReceita.parcela_total ?? null)
            : numParcelas > 1
              ? numParcelas
              : null,
        });
      }

      let error = null;

      if (selectedReceita) {
        ({ error } = await supabase
          .from("receitas")
          .update(receitasToInsert[0] as never)
          .eq("id", selectedReceita.id));
      } else {
        ({ error } = await supabase.from("receitas").insert(receitasToInsert as never));
      }

      if (error) throw error;

      toast.success(selectedReceita ? "Receita atualizada" : "Receita cadastrada", {
        description: selectedReceita
          ? `1 registro atualizado com sucesso`
          : `${numParcelas} registro(s) criado(s) com sucesso`,
      });

      setIsDialogOpen(false);
      fetchReceitas();
      resetForm();
    } catch (err: unknown) {
      toast.error("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (formData) => {
    if (selectedReceita) {
      await saveReceita(formData);
      return;
    }

    setIsSaving(true);
    try {
      const valorNumerico = parseCurrencyString(formData.valorTotal);
      const numParcelas = parseInt(formData.parcelas) || 1;
      const valorParcela = valorNumerico / numParcelas;

      const found = await checkDuplicates({
        table: "receitas",
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
      toast.error("Erro ao salvar receita");
    } finally {
      if (!showDuplicateWarning) setIsSaving(false);
    }

    await saveReceita(formData);
  });

  const resetForm = () => {
    form.reset(receitaDefaultValues);
    setSelectedReceita(null);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; grupoId: string; label: string } | null>(
    null
  );

  const handleDelete = (id: string) => {
    const receita = receitas.find((r) => r.id === id);
    if (receita?.grupo_parcela) {
      const total = receita.parcela_total ?? receitas.filter((r) => r.grupo_parcela === receita.grupo_parcela).length;
      setDeleteGroupTarget({
        id,
        grupoId: receita.grupo_parcela,
        label: `parcela ${receita.parcela_numero ?? "?"} de ${total}`,
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
      const { error } = await supabase.from("receitas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Receita excluída");
      await fetchReceitas();
    } catch (err) {
      toast.error("Falha ao excluir receita", {
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
          .from("receitas")
          .update({ deleted_at: now })
          .eq("grupo_parcela", grupoId)
          .is("deleted_at", null);
        if (error) throw error;
        toast.success("Grupo de parcelas excluído");
      } else {
        const { error } = await supabase.from("receitas").update({ deleted_at: now }).eq("id", id);
        if (error) throw error;
        toast.success("Parcela excluída");
      }
      await fetchReceitas();
    } catch (err) {
      toast.error("Falha ao excluir", { description: err instanceof Error ? err.message : "Tente novamente" });
    }
  };

  return (
    <div className="space-y-8 w-full max-w-none">
      <Card className="rounded-2xl border border-black/10 bg-white p-6 w-full">
        <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium tracking-tight">Lista de Receitas</CardTitle>
            <CardDescription className="text-sm text-black/60 mt-1">
              Total de {receitas.length} receita(s) cadastrada(s)
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
                  <DialogTitle>Configurações de Receitas</DialogTitle>
                  <DialogDescription>Gerencie as categorias de receitas</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="categorias" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="categorias">Categorias</TabsTrigger>
                    <TabsTrigger value="asaas">Asaas</TabsTrigger>
                  </TabsList>
                  <TabsContent value="categorias" className="mt-4">
                    <CategoryManager
                      title="Categorias de Receitas"
                      description="Gerencie as categorias disponíveis para classificar receitas"
                      type="Receita"
                      onCategoryChange={handleCategoryChange}
                    />
                  </TabsContent>
                  <TabsContent value="asaas" className="mt-4">
                    <AsaasConfigForm />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (open) {
                  setSelectedReceita(null);
                  resetForm();
                }
              }}
            >
              {canEdit && (
                <DialogTrigger asChild>
                  <Button className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-ink transition-colors px-5 py-2.5 text-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Receita
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
                <div className="px-6 pt-6 pb-4 border-b">
                  <DialogHeader>
                    <DialogTitle>{selectedReceita ? "Editar Receita" : "Nova Receita"}</DialogTitle>
                    <DialogDescription>
                      {selectedReceita ? "Atualize os dados da receita" : "Cadastre uma nova receita"}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <form onSubmit={handleSubmit} className="divide-y">
                  {selectedReceita?.grupo_parcela && (
                    <div className="px-6 pt-4 pb-0">
                      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <span className="font-medium">
                          Parcela {selectedReceita.parcela_numero ?? "?"} de {selectedReceita.parcela_total ?? "?"}
                        </span>
                        <span className="text-amber-600">
                          — faz parte de um grupo. Editar aqui altera só esta parcela.
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Descrição</Label>
                    <Input
                      id="descricao"
                      {...form.register("descricao")}
                      placeholder="Ex: Pagamento projeto residencial"
                    />
                  </div>

                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                      Dados Financeiros
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="valorTotal" className="text-xs">
                          Valor Total (R$) *
                        </Label>
                        <Input
                          id="valorTotal"
                          type="text"
                          value={form.watch("valorTotal")}
                          onChange={handleValorChange}
                          placeholder="R$ 0,00"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="parcelas" className="text-xs">
                          Parcelas
                        </Label>
                        <Input id="parcelas" type="number" min="1" {...form.register("parcelas")} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="status" className="text-xs">
                          Status
                        </Label>
                        <Select
                          value={form.watch("status")}
                          onValueChange={(v) => form.setValue("status", v as "Recebida" | "Pendente")}
                        >
                          <SelectTrigger id="status" className="h-9">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Recebida">Recebida</SelectItem>
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
                          <SelectTrigger id="formaPagamento" className="h-9">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PIX">PIX</SelectItem>
                            <SelectItem value="Transferência">Transferência</SelectItem>
                            <SelectItem value="Boleto">Boleto</SelectItem>
                            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

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
                      <div className="space-y-1.5">
                        <Label className="text-xs">Recorrência</Label>
                        <Select
                          value={form.watch("recorrencia")}
                          onValueChange={(v) => form.setValue("recorrencia", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Nenhuma">Nenhuma</SelectItem>
                            <SelectItem value="Semanal">Semanal</SelectItem>
                            <SelectItem value="Mensal">Mensal</SelectItem>
                            <SelectItem value="Anual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                      Vínculos e Classificação
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cliente (Pagante)</Label>
                        <Select value={form.watch("clienteId")} onValueChange={(v) => form.setValue("clienteId", v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Projeto</Label>
                        <Select value={form.watch("projetoID")} onValueChange={(v) => form.setValue("projetoID", v)}>
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
                        <Label className="text-xs">
                          Conta de Recebimento
                          {form.watch("status") === "Recebida" && <span className="text-red-500 ml-0.5">*</span>}
                        </Label>
                        <Select value={form.watch("contaId")} onValueChange={(v) => form.setValue("contaId", v)}>
                          <SelectTrigger className={`h-9 ${form.formState.errors.contaId ? "border-red-500" : ""}`}>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {contas.map((conta) => (
                              <SelectItem key={conta.id} value={conta.id}>
                                {conta.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.contaId && (
                          <p className="text-xs text-red-500">{form.formState.errors.contaId.message}</p>
                        )}
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
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nota Fiscal</Label>
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
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Observação</Label>
                    <Input id="observacao" {...form.register("observacao")} placeholder="Observações adicionais" />
                  </div>

                  <div className="flex gap-2 px-6 py-4 bg-gray-50/30">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1"
                      disabled={isSaving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-ink"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                        </>
                      ) : selectedReceita ? (
                        "Atualizar"
                      ) : (
                        "Salvar"
                      )}
                    </Button>
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
              placeholder="Buscar por descrição ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 max-w-xs text-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {receitasFiltradas.length} de {receitas.length}
            </span>
          </div>
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data (Venc/Pag)</TableHead>{" "}
                  {/* Mais claro: mostra vencimento para pendentes, pagamento para recebidos */}
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Forma Pag.</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receitasFiltradas.map((receita) => (
                  <TableRow
                    key={receita.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      setSelectedReceita(receita);
                      setIsDetailOpen(true);
                    }}
                  >
                    <TableCell>{getReceitaDisplayDate(receita)}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {receita.descricao}
                        {receita.asaas_payment_status && (
                          <Badge
                            variant="outline"
                            className={
                              receita.asaas_payment_status === "RECEIVED" ||
                              receita.asaas_payment_status === "CONFIRMED"
                                ? "border-green-500 text-green-700 text-[10px] px-1 py-0"
                                : receita.asaas_payment_status === "PENDING"
                                  ? "border-yellow-500 text-yellow-700 text-[10px] px-1 py-0"
                                  : receita.asaas_payment_status === "OVERDUE"
                                    ? "border-red-500 text-red-700 text-[10px] px-1 py-0"
                                    : "border-gray-400 text-gray-600 text-[10px] px-1 py-0"
                            }
                          >
                            Asaas
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{receita.cliente_nome || "-"}</TableCell>
                    <TableCell>{receita.projeto_codigo || "-"}</TableCell>
                    <TableCell>{receita.categoria_nome || "-"}</TableCell>
                    <TableCell>{receita.forma_pagamento || "-"}</TableCell>
                    <TableCell>
                      {receita.parcela_numero && receita.parcela_total
                        ? `${receita.parcela_numero}/${receita.parcela_total}`
                        : "1/1"}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      R$ {receita.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          receita.status === "Recebido" || receita.status === "Recebida" ? "default" : "secondary"
                        }
                        className={
                          receita.status === "Recebido" || receita.status === "Recebida"
                            ? "bg-green-500 hover:bg-green-600"
                            : ""
                        }
                      >
                        {receita.status}
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
                              onClick={() => openEditReceita(receita)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(receita.id)}
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

      {/* Modal de Detalhes */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Receita</DialogTitle>
            <DialogDescription>Informações completas da receita selecionada</DialogDescription>
          </DialogHeader>

          {selectedReceita && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Data Vencimento</Label>
                  <p className="text-sm font-medium">{formatDateDisplay(selectedReceita.data_vencimento)}</p>
                </div>
                {selectedReceita.data_recebimento &&
                  selectedReceita.data_recebimento !== selectedReceita.data_vencimento && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Data Recebimento</Label>
                      <p className="text-sm font-medium text-green-600">
                        {formatDateDisplay(selectedReceita.data_recebimento)}
                      </p>
                    </div>
                  )}
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <p className="text-sm font-bold text-green-600">
                    R$ {selectedReceita.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <p className="text-sm font-medium">{selectedReceita.descricao}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="text-sm">{selectedReceita.status}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <p className="text-sm">{selectedReceita.categoria_nome || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="text-sm">{selectedReceita.cliente_nome || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Projeto</Label>
                  <p className="text-sm">{selectedReceita.projeto_codigo || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Forma de Pagamento</Label>
                  <p className="text-sm">{selectedReceita.forma_pagamento || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Conta</Label>
                  <p className="text-sm">{contas.find((c) => c.id === selectedReceita.conta_id)?.nome || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nota Fiscal</Label>
                  <p className="text-sm">{selectedReceita.nota_fiscal || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Parcela</Label>
                  <p className="text-sm">
                    {selectedReceita.parcela_numero && selectedReceita.parcela_total
                      ? `${selectedReceita.parcela_numero}/${selectedReceita.parcela_total}`
                      : "1/1"}
                  </p>
                </div>
                {selectedReceita.status !== "Recebido" && (
                  <div className="col-span-2 pt-1">
                    <Label className="text-xs text-muted-foreground mb-2 block">Cobrança</Label>
                    <div className="flex flex-wrap gap-2">
                      <CobrarPorEmailButton
                        receitaId={selectedReceita.id}
                        onSuccess={() => {
                          fetchReceitas();
                        }}
                      />
                      <AsaasCobrancaButton
                        receitaId={selectedReceita.id}
                        asaasPaymentUrl={selectedReceita.asaas_payment_url}
                        asaasPaymentStatus={selectedReceita.asaas_payment_status}
                        asaasBillingType={selectedReceita.asaas_billing_type}
                        onSuccess={() => {
                          fetchReceitas();
                          setIsDetailOpen(false);
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      <strong>Email:</strong> cobrança direta pela Pilar (sem taxa). <strong>Asaas:</strong> gera
                      Pix/boleto (com taxa).
                    </p>
                  </div>
                )}
                {canEdit && (
                  <div className="col-span-2">
                    <Button variant="outline" className="flex-1" onClick={() => openEditReceita(selectedReceita)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        handleDelete(selectedReceita.id);
                        setIsDetailOpen(false);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            saveReceita(pendingFormData);
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
        title="Excluir receita?"
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
