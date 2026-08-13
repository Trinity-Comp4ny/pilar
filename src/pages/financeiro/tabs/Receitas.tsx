import { useEffect, useMemo, useState } from "react";
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
import { CalendarIcon, Plus, Settings, Pencil, Trash2, QrCode, MoreVertical, CheckCircle2, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "../components/CategoryManager";
import { Badge } from "@/components/ui/badge";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { formatValorToInput } from "@/lib/currencyUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { receitaSchema, receitaDefaultValues, type ReceitaFormData } from "@/schemas/receitaSchema";
import { DuplicateWarningDialog } from "@/components/DuplicateWarningDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AsaasCobrancaButton } from "@/components/asaas/AsaasCobrancaButton";
import { AsaasConfigForm } from "@/components/asaas/AsaasConfigForm";
import { CobrarPorEmailButton } from "@/components/CobrarPorEmailButton";
import { useFinanceItems, type ReceitaItem } from "../hooks/useFinanceItems";
import { useFinanceItemMutations } from "../hooks/useFinanceItemMutations";
import { useFinanceItemForm } from "../hooks/useFinanceItemForm";
import { FinanceItemForm, ParcelaBanner, DeleteGroupDialog } from "../components/FinanceItemForm";

const getReceitaDisplayDate = (r: ReceitaItem): string =>
  formatDateDisplay(getDisplayDate(r.data_recebimento ?? null, r.data_vencimento, r.status));

export default function Receitas() {
  const { canEdit } = useFeatureAccess("financeiro");
  const { items: receitasRaw, aux, refetch, isError } = useFinanceItems("receita");
  const { categorias, contas, projetos, clientes } = aux;

  const { saveReceita, deleteOne, deleteGroup, marcarRecebida, marcarPendente } = useFinanceItemMutations("receita");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedReceita, setSelectedReceita] = useState<ReceitaItem | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const form = useForm<ReceitaFormData>({
    resolver: zodResolver(receitaSchema),
    defaultValues: receitaDefaultValues,
  });

  const receitas = useMemo(() => receitasRaw, [receitasRaw]);

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

  const onSave = async (formData: ReceitaFormData) => {
    await saveReceita.mutateAsync({ formData, selected: selectedReceita });
    setIsDialogOpen(false);
    setSelectedReceita(null);
    form.reset(receitaDefaultValues);
  };

  const formCtl = useFinanceItemForm({
    form,
    table: "receitas",
    isDialogOpen,
    hasSelected: !!selectedReceita,
    onSave,
  });

  const openEditReceita = (receita: ReceitaItem) => {
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

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; grupoId: string; label: string } | null>(
    null
  );
  const [confirmRecebidaId, setConfirmRecebidaId] = useState<string | null>(null);

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
      setSelectedReceita(null);
    }
  }, [isDialogOpen]);

  const Step1 = (
    <>
      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Descrição</Label>
        <Input id="descricao" {...form.register("descricao")} placeholder="Ex: Pagamento projeto residencial" />
      </div>

      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Dados Financeiros</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="valorTotal" className="text-xs">
              Valor Total (R$) *
            </Label>
            <Input
              id="valorTotal"
              type="text"
              value={form.watch("valorTotal")}
              onChange={formCtl.handleValorChange}
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
            <Select value={form.watch("formaPagamento")} onValueChange={(v) => form.setValue("formaPagamento", v)}>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Recorrência</Label>
            <Select value={form.watch("recorrencia")} onValueChange={(v) => form.setValue("recorrencia", v)}>
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
    </>
  );

  const clienteId = form.watch("clienteId");
  const clienteSel = clientes.find((c) => c.id === clienteId);
  const chavesPix = clienteSel?.chaves_pix ?? [];

  const Step2 = (
    <>
      <div className="px-6 py-4 space-y-3">
        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Vínculos e Classificação</Label>
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
            {chavesPix.length > 0 && (
              <div className="rounded-md border border-dashed px-3 py-2 space-y-1 bg-muted/30">
                {chavesPix.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <QrCode className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{c.chave}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto">
                      {TIPO_CHAVE_PIX_LABEL[c.tipo as keyof typeof TIPO_CHAVE_PIX_LABEL] ?? c.tipo}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
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
              {form.watch("status") === "Recebida" && <span className="text-danger-mid ml-0.5">*</span>}
            </Label>
            <Select value={form.watch("contaId")} onValueChange={(v) => form.setValue("contaId", v)}>
              <SelectTrigger className={`h-9 ${form.formState.errors.contaId ? "border-destructive" : ""}`}>
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
              <p className="text-xs text-danger-mid">{form.formState.errors.contaId.message}</p>
            )}
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
    </>
  );

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
                    />
                  </TabsContent>
                  <TabsContent value="asaas" className="mt-4">
                    <AsaasConfigForm />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            {canEdit && (
              <Button
                onClick={() => {
                  setSelectedReceita(null);
                  form.reset(receitaDefaultValues);
                  setIsDialogOpen(true);
                }}
                variant="brand"
                className="rounded-full px-5 py-2.5 text-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Receita
              </Button>
            )}

            <FinanceItemForm
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              isEdit={!!selectedReceita}
              tipo="receita"
              step={formCtl.step}
              setStep={formCtl.setStep}
              hasSelected={!!selectedReceita}
              isSaving={formCtl.isSaving}
              onSubmit={formCtl.submit}
              onNext={formCtl.goNext}
              onBack={formCtl.goBack}
              step1={Step1}
              step2={Step2}
              parcelaBanner={
                selectedReceita?.grupo_parcela ? (
                  <ParcelaBanner numero={selectedReceita.parcela_numero} total={selectedReceita.parcela_total} />
                ) : undefined
              }
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isError && (
            <div className="mx-4 mt-4 rounded-lg border border-danger-mid-border bg-danger-soft px-4 py-3 text-sm text-danger-strong">
              Não foi possível carregar as receitas. Verifique a conexão e recarregue a página — os valores abaixo podem
              estar incompletos.
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/50">
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
                  <TableHead>Data (Venc/Pag)</TableHead>
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
                    className="cursor-pointer hover:bg-muted"
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
                                ? "border-status-done text-positive-strong text-[10px] px-1 py-0"
                                : receita.asaas_payment_status === "PENDING"
                                  ? "border-yellow-500 text-warning-strong text-[10px] px-1 py-0"
                                  : receita.asaas_payment_status === "OVERDUE"
                                    ? "border-red-500 text-danger-strong text-[10px] px-1 py-0"
                                    : "border-gray-400 text-ink-muted text-[10px] px-1 py-0"
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
                    <TableCell className="text-positive-strong font-medium">
                      R$ {receita.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          receita.status === "Recebido" || receita.status === "Recebida" ? "default" : "secondary"
                        }
                        className={
                          receita.status === "Recebido" || receita.status === "Recebida"
                            ? "bg-positive/100 hover:bg-positive"
                            : ""
                        }
                      >
                        {receita.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações da receita">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditReceita(receita)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            {receita.status !== "Recebido" && receita.status !== "Recebida" ? (
                              <DropdownMenuItem onClick={() => setConfirmRecebidaId(receita.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-positive-strong" />
                                Marcar como recebida
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => marcarPendente.mutate(receita.id)}>
                                <Clock className="mr-2 h-4 w-4 text-warning-mid" />
                                Marcar como pendente
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-danger-mid focus:text-danger-mid"
                              onClick={() => handleDelete(receita.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
                      <p className="text-sm font-medium text-positive-strong">
                        {formatDateDisplay(selectedReceita.data_recebimento)}
                      </p>
                    </div>
                  )}
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <p className="text-sm font-bold text-positive-strong">
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
                      <CobrarPorEmailButton receitaId={selectedReceita.id} onSuccess={() => refetch()} />
                      <AsaasCobrancaButton
                        receitaId={selectedReceita.id}
                        asaasPaymentUrl={selectedReceita.asaas_payment_url}
                        asaasPaymentStatus={selectedReceita.asaas_payment_status}
                        asaasBillingType={selectedReceita.asaas_billing_type}
                        onSuccess={() => {
                          refetch();
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
        open={formCtl.showDuplicateWarning}
        onOpenChange={(open) => {
          formCtl.setShowDuplicateWarning(open);
          if (!open) formCtl.setPendingFormData(null);
        }}
        duplicates={formCtl.duplicates}
        onConfirm={formCtl.confirmDuplicate}
      />

      <ConfirmDialog
        open={confirmRecebidaId !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmRecebidaId(null);
        }}
        onConfirm={() => {
          if (confirmRecebidaId)
            marcarRecebida.mutate(confirmRecebidaId, { onSettled: () => setConfirmRecebidaId(null) });
        }}
        title="Confirmar recebimento?"
        description="Deseja marcar esta receita como recebida?"
        confirmText="Confirmar"
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

      <DeleteGroupDialog
        target={deleteGroupTarget}
        onCancel={() => setDeleteGroupTarget(null)}
        onConfirm={confirmDeleteGroup}
      />
    </div>
  );
}
