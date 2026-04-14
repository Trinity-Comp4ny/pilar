import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Settings, Pencil, Trash2, Loader2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "../components/CategoryManager";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/maskUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { receitaSchema, receitaDefaultValues, type ReceitaFormData } from "@/schemas/receitaSchema";
import { getSafeErrorMessage } from "@/lib/safeError";

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
}

export default function Receitas() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [contas, setContas] = useState<{ id: string, nome: string }[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedReceita, setSelectedReceita] = useState<Receita | null>(null);

  const { data: userRole } = useUserRole();
  const isAdmin = userRole === 'admin';

  const form = useForm<ReceitaFormData>({
    resolver: zodResolver(receitaSchema),
    defaultValues: receitaDefaultValues,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const [categorias, setCategorias] = useState<{ id: string, name: string }[]>([]);
  const [projetos, setProjetos] = useState<{ id: string, projetoID: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string, nome: string }[]>([]);
  const { toast } = useToast();

  const receitasFiltradas = receitas.filter((r) => {
    const matchSearch = !searchTerm || r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || (r.cliente_nome || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "todos" || (statusFilter === "recebido" && r.status === "Recebido") || (statusFilter === "pendente" && r.status === "Pendente") || (statusFilter === "atrasado" && r.status === "Atrasado");
    return matchSearch && matchStatus;
  });

  const fetchAuxiliaryData = async () => {
    // Fetch Categorias
    const { data: categoriasData } = await supabase
      .from('categorias_financeiras')
      .select('*')
      .eq('tipo', 'Receita')
      .order('nome');

    if (categoriasData) {
      setCategorias((categoriasData ?? []).map((cat) => ({ id: cat.id, name: cat.nome })));
    }

    // Fetch Clientes
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');

    if (clientesData) {
      setClientes((clientesData ?? []).map((c) => ({ id: c.id, nome: c.nome })));
    }

    // Fetch Contas
    const { data: contasData } = await supabase
      .from('contas')
      .select('*')
      .order('nome');

    if (contasData) {
      setContas((contasData ?? []).map((c) => ({ id: c.id, nome: c.nome })));
    }

    // Fetch Projetos
    const { data: projetosData } = await supabase
      .from('projetos')
      .select('id, nome, codigo_projeto')
      .order('nome');

    if (projetosData) {
      setProjetos((projetosData ?? []).map((p) => ({ id: p.id, projetoID: p.codigo_projeto })));
    }
  };

  // Fetch Initial Data
  useEffect(() => {
    fetchReceitas();
    fetchAuxiliaryData();
  }, []);

  const fetchReceitas = async () => {
    const { data, error } = await supabase
      .from('receitas')
      .select(`
        *,
        categorias_financeiras (nome),
        clientes (nome),
        projetos (codigo_projeto)
      `)
      .order('data_recebimento', { ascending: false }) // Ordena por data_recebimento (automação Bradesco)
      .order('data_vencimento', { ascending: false }); // Fallback para data_vencimento (manual)

    if (error) {
      // Error will be visible through empty data state
    }

    if (data) {
      const formattedData = (data ?? []).map((d) => ({
        ...d,
        categoria_nome: d.categorias_financeiras?.nome,
        cliente_nome: d.clientes?.nome,
        projeto_codigo: d.projetos?.codigo_projeto,
        data_recebimento: d.data_recebimento || d.data_vencimento
      }));
      setReceitas(formattedData);
    }
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
      valorTotal: formatCurrencyInput((receita.valor * 100).toString()),
      status: receita.status === 'Recebido' ? 'Recebida' : 'Pendente',
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

  const handleSubmit = form.handleSubmit(async (formData) => {
    setIsSaving(true);
    try {
      const numParcelas = parseInt(formData.parcelas) || 1;
      const valorNumerico = parseCurrencyString(formData.valorTotal);
      const valorParcela = valorNumerico / numParcelas;
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado");

      const { data: empresaId } = await supabase.rpc('get_user_empresa_id');
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      const receitasToInsert = [];

      for (let i = 0; i < numParcelas; i++) {
        const dataParcela = addMonths(formData.dataVencimento, i);
        const dataStr = format(dataParcela, 'yyyy-MM-dd');

        receitasToInsert.push({
          data_vencimento: dataStr,
          data_recebimento: formData.status === 'Recebida' ? dataStr : null,
          descricao: numParcelas > 1 ? `${formData.descricao} (${i + 1}/${numParcelas})` : formData.descricao,
          projeto_id: formData.projetoID || null,
          categoria_id: formData.categoriaId || null,
          valor: valorParcela,
          forma_pagamento: formData.formaPagamento || null,
          nota_fiscal: formData.notaFiscal || null,
          status: formData.status === 'Recebida' ? 'Recebido' : 'Pendente',
          conta_id: formData.contaId || null,
          cliente_id: formData.clienteId || null,
          observacao: formData.observacao || null,
          empresa_id: empresaId
        });
      }

      const dataToInsert = receitasToInsert.map(r => ({
        ...r,
        valor: r.valor
      }));

      let error = null;

      if (selectedReceita) {
        ({ error } = await supabase.from('receitas')
          .update(dataToInsert[0])
          .eq('id', selectedReceita.id));
      } else {
        ({ error } = await supabase.from('receitas')
          .insert(dataToInsert));
      }

      if (error) throw error;

      toast({
        title: selectedReceita ? "Receita atualizada" : "Receita cadastrada",
        description: selectedReceita ? `1 registro atualizado com sucesso` : `${numParcelas} registro(s) criado(s) com sucesso`,
      });

      setIsDialogOpen(false);
      fetchReceitas();
      resetForm();
    } catch (err: unknown) {
      toast({
        title: "Erro ao salvar",
        description: getSafeErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  });

  const resetForm = () => {
    form.reset(receitaDefaultValues);
    setSelectedReceita(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('receitas').delete().eq('id', id);
    if (!error) {
      toast({ title: "Receita excluída" });
      fetchReceitas();
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
                  <DialogDescription>
                    Gerencie as categorias de receitas
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="categorias" className="mt-4">
                  <TabsList className="grid w-full grid-cols-1">
                    <TabsTrigger value="categorias">Categorias</TabsTrigger>
                  </TabsList>
                  <TabsContent value="categorias" className="mt-4">
                    <CategoryManager
                      title="Categorias de Receitas"
                      description="Gerencie as categorias disponíveis para classificar receitas"
                      type="Receita"
                      onCategoryChange={handleCategoryChange}
                    />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (open) {
                setSelectedReceita(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Receita
                </Button>
              </DialogTrigger>
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
                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Descrição</Label>
                    <Input id="descricao" {...form.register("descricao")} placeholder="Ex: Pagamento projeto residencial" />
                  </div>

                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Dados Financeiros</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="valorTotal" className="text-xs">Valor Total (R$) *</Label>
                        <Input id="valorTotal" type="text" value={form.watch("valorTotal")} onChange={handleValorChange} placeholder="R$ 0,00" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="parcelas" className="text-xs">Parcelas</Label>
                        <Input id="parcelas" type="number" min="1" {...form.register("parcelas")} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="status" className="text-xs">Status</Label>
                        <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as "Recebida" | "Pendente")}>
                          <SelectTrigger id="status" className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Recebida">Recebida</SelectItem>
                            <SelectItem value="Pendente">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="formaPagamento" className="text-xs">Forma Pgto.</Label>
                        <Select value={form.watch("formaPagamento")} onValueChange={(v) => form.setValue("formaPagamento", v)}>
                          <SelectTrigger id="formaPagamento" className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                              className={cn("w-full justify-start text-left font-normal text-xs h-9", !form.watch("dataVencimento") && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {form.watch("dataVencimento") ? format(form.watch("dataVencimento"), "dd/MM/yyyy") : "Selecionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={form.watch("dataVencimento")} onSelect={(d) => form.setValue("dataVencimento", d as Date)} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Recorrência</Label>
                        <Select value={form.watch("recorrencia")} onValueChange={(v) => form.setValue("recorrencia", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Vínculos e Classificação</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cliente (Pagante)</Label>
                        <Select value={form.watch("clienteId")} onValueChange={(v) => form.setValue("clienteId", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Projeto</Label>
                        <Select value={form.watch("projetoID")} onValueChange={(v) => form.setValue("projetoID", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {projetos.map((proj) => (
                              <SelectItem key={proj.id} value={proj.id}>{proj.projetoID}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Conta de Recebimento</Label>
                        <Select value={form.watch("contaId")} onValueChange={(v) => form.setValue("contaId", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {contas.map((conta) => (
                              <SelectItem key={conta.id} value={conta.id}>{conta.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Categoria</Label>
                        <Select value={form.watch("categoriaId")} onValueChange={(v) => form.setValue("categoriaId", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {categorias.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nota Fiscal</Label>
                        <Select value={form.watch("notaFiscal")} onValueChange={(v) => form.setValue("notaFiscal", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1" disabled={isSaving}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white" disabled={isSaving}>
                      {isSaving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                      ) : (
                        selectedReceita ? "Atualizar" : "Salvar"
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
            <span className="text-xs text-muted-foreground ml-auto">{receitasFiltradas.length} de {receitas.length}</span>
          </div>
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data (Venc/Pag)</TableHead> {/* Mais claro: mostra vencimento para pendentes, pagamento para recebidos */}
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
                    <TableCell className="font-medium">{receita.descricao}</TableCell>
                    <TableCell>{receita.cliente_nome || "-"}</TableCell>
                    <TableCell>{receita.projeto_codigo || "-"}</TableCell>
                    <TableCell>{receita.categoria_nome || "-"}</TableCell>
                    <TableCell>{receita.forma_pagamento || "-"}</TableCell>
                    <TableCell>{receita.parcelas || "1"}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      R$ {receita.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={receita.status === 'Recebido' || receita.status === 'Recebida' ? 'default' : 'secondary'} className={receita.status === 'Recebido' || receita.status === 'Recebida' ? 'bg-green-500 hover:bg-green-600' : ''}>
                        {receita.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEditReceita(receita)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(receita.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            <DialogDescription>
              Informações completas da receita selecionada
            </DialogDescription>
          </DialogHeader>

          {selectedReceita && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Data Vencimento</Label>
                  <p className="text-sm font-medium">{formatDateDisplay(selectedReceita.data_vencimento)}</p>
                </div>
                {selectedReceita.data_recebimento && selectedReceita.data_recebimento !== selectedReceita.data_vencimento && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Recebimento</Label>
                    <p className="text-sm font-medium text-green-600">{formatDateDisplay(selectedReceita.data_recebimento)}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <p className="text-sm font-bold text-green-600">R$ {selectedReceita.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
                  <p className="text-sm">{contas.find(c => c.id === selectedReceita.conta_id)?.nome || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nota Fiscal</Label>
                  <p className="text-sm">{selectedReceita.nota_fiscal || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Parcelas</Label>
                  <p className="text-sm">{selectedReceita.parcelas || "1"}</p>
                </div>
                <div className="col-span-2">
                  <Button variant="outline" className="flex-1" onClick={() => openEditReceita(selectedReceita)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => {
                    handleDelete(selectedReceita.id);
                    setIsDetailOpen(false);
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
