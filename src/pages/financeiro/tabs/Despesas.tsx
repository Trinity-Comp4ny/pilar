import { useEffect, useMemo, useState } from "react";
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
import { CalendarIcon, Plus, Settings, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "../components/CategoryManager";
import { SupplierManager } from "../components/SupplierManager";
import { Badge } from "@/components/ui/badge";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { formatValorToInput } from "@/lib/currencyUtils";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { DuplicateWarningDialog } from "@/components/DuplicateWarningDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DespesaDetailDialog } from "./DespesaDetailDialog";
import { useFinanceItems, type DespesaItem } from "../hooks/useFinanceItems";
import { useFinanceItemMutations } from "../hooks/useFinanceItemMutations";
import { useFinanceItemForm } from "../hooks/useFinanceItemForm";
import { FinanceItemForm, ParcelaBanner, DeleteGroupDialog } from "../components/FinanceItemForm";

const getDespesaDisplayDate = (d: DespesaItem): string =>
  formatDateDisplay(getDisplayDate(d.data_pagamento ?? null, d.data_vencimento, d.status));

export default function Despesas() {
  const { canEdit } = useFeatureAccess("financeiro");
  const { items: despesasRaw, aux, isError } = useFinanceItems("despesa");
  const { categorias, contas, cartoes, projetos, fornecedores } = aux;

  const { saveDespesa, deleteOne, deleteGroup } = useFinanceItemMutations("despesa");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<DespesaItem | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const form = useForm<DespesaFormData>({
    resolver: zodResolver(despesaSchema),
    defaultValues: despesaDefaultValues,
  });

  const despesas = useMemo(() => {
    return despesasRaw.map((d) => {
      let forma = "-";
      if (d.cartao_id) {
        const cartao = cartoes.find((c) => c.id === d.cartao_id);
        forma = cartao?.tipo === "debito" ? "Cartão de Débito" : "Cartão de Crédito";
      } else if (d.conta_id) forma = "Conta/Outro";
      return {
        ...d,
        categoria_nome: categorias.find((c) => c.id === d.categoria_id)?.name || d.categoria_id,
        forma_pagamento: forma,
      };
    });
  }, [despesasRaw, categorias, cartoes]);

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

  const onSave = async (formData: DespesaFormData) => {
    await saveDespesa.mutateAsync({
      formData,
      selected: selectedDespesa,
      cartoes: cartoes.map((c) => ({ id: c.id, dia_fechamento: c.dia_fechamento })),
    });
    setIsDialogOpen(false);
    setSelectedDespesa(null);
    form.reset(despesaDefaultValues);
  };

  const formCtl = useFinanceItemForm({
    form,
    table: "despesas",
    isDialogOpen,
    hasSelected: !!selectedDespesa,
    onSave,
  });

  const openEditDespesa = (despesa: DespesaItem) => {
    setSelectedDespesa(despesa);
    const cartao = cartoes.find((c) => c.id === despesa.cartao_id);
    const formaPgto = despesa.cartao_id ? (cartao?.tipo === "debito" ? "Cartão de Débito" : "Cartão de Crédito") : "";
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
      recorrente: despesa.recorrente || false,
      periodicidade: despesa.periodicidade || "mensal",
    });
    setIsDetailOpen(false);
    setIsDialogOpen(true);
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
    await deleteOne.mutateAsync(id);
  };

  const confirmDeleteGroup = async (mode: "single" | "all") => {
    if (!deleteGroupTarget) return;
    const target = deleteGroupTarget;
    setDeleteGroupTarget(null);
    setIsDetailOpen(false);
    await deleteGroup.mutateAsync({ id: target.id, grupoId: target.grupoId, mode });
  };

  useEffect(() => {
    if (!isDialogOpen) {
      setSelectedDespesa(null);
    }
  }, [isDialogOpen]);

  const formaPag = form.watch("formaPagamento");
  const isCartao = formaPag === "Cartão de Crédito" || formaPag === "Cartão de Débito";

  const Step1 = (
    <>
      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Descrição</Label>
        <div>
          <Input id="descricao" {...form.register("descricao")} placeholder="Ex: Material de escritório, Aluguel" />
          {form.formState.errors.descricao && (
            <p className="text-xs text-red-500 mt-1">{form.formState.errors.descricao.message}</p>
          )}
        </div>
      </div>

      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Dados Financeiros</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="valorTotal" className="text-xs">
              Valor (R$) *
            </Label>
            <Input
              id="valorTotal"
              type="text"
              value={form.watch("valorTotal")}
              onChange={formCtl.handleValorChange}
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
            {selectedDespesa && <p className="text-xs text-muted-foreground">Editando parcela individual</p>}
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
            <Select value={form.watch("formaPagamento")} onValueChange={(v) => form.setValue("formaPagamento", v)}>
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
                  {form.watch("dataVencimento") ? format(form.watch("dataVencimento"), "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch("dataVencimento")}
                  onSelect={(d) => form.setValue("dataVencimento", d as Date)}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </>
  );

  const Step2 = (
    <>
      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Conta / Cartão</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isCartao ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Cartão</Label>
              <Select value={form.watch("cartaoId")} onValueChange={(v) => form.setValue("cartaoId", v)}>
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
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Vínculos</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor</Label>
            <Select value={form.watch("fornecedorId")} onValueChange={(v) => form.setValue("fornecedorId", v)}>
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
            <Label className="text-xs">Categoria</Label>
            <Select value={form.watch("categoriaId")} onValueChange={(v) => form.setValue("categoriaId", v)}>
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

      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Observação</Label>
        <Input id="observacao" {...form.register("observacao")} placeholder="Observações adicionais" />
      </div>

      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Recorrência</Label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" {...form.register("recorrente")} />
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
  );

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
                    />
                  </TabsContent>
                  <TabsContent value="fornecedores" className="mt-4">
                    <SupplierManager />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            {canEdit && (
              <Button
                onClick={() => {
                  setSelectedDespesa(null);
                  form.reset(despesaDefaultValues);
                  setIsDialogOpen(true);
                }}
                variant="brand"
                className="rounded-full px-5 py-2.5 text-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Despesa
              </Button>
            )}

            <FinanceItemForm
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              isEdit={!!selectedDespesa}
              tipo="despesa"
              step={formCtl.step}
              setStep={formCtl.setStep}
              hasSelected={!!selectedDespesa}
              isSaving={formCtl.isSaving}
              onSubmit={formCtl.submit}
              onNext={formCtl.goNext}
              onBack={formCtl.goBack}
              step1={Step1}
              step2={Step2}
              step2Description="Conta, vínculos e recorrência"
              parcelaBanner={
                selectedDespesa?.grupo_parcela ? (
                  <ParcelaBanner numero={selectedDespesa.parcela_numero} total={selectedDespesa.parcela_total} />
                ) : undefined
              }
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isError && (
            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar as despesas. Verifique a conexão e recarregue a página — os valores abaixo podem
              estar incompletos.
            </div>
          )}
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
                  <TableHead>Data (Venc/Pag)</TableHead>
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
                              aria-label="Editar despesa"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(despesa.id)}
                              aria-label="Excluir despesa"
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
        open={formCtl.showDuplicateWarning}
        onOpenChange={(open) => {
          formCtl.setShowDuplicateWarning(open);
          if (!open) formCtl.setPendingFormData(null);
        }}
        duplicates={formCtl.duplicates}
        onConfirm={formCtl.confirmDuplicate}
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

      <DeleteGroupDialog
        target={deleteGroupTarget}
        onCancel={() => setDeleteGroupTarget(null)}
        onConfirm={confirmDeleteGroup}
      />
    </div>
  );
}
