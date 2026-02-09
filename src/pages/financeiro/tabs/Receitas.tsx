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
import { CalendarIcon, Plus, Settings, Pencil, Trash2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "../components/CategoryManager";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

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

  // Form States
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [descricao, setDescricao] = useState("");
  const [projetoID, setProjetoID] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [status, setStatus] = useState("Recebida");
  const [contaId, setContaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [recorrencia, setRecorrencia] = useState("Nenhuma");
  const [parcelas, setParcelas] = useState("1");

  const [categorias, setCategorias] = useState<{ id: string, name: string }[]>([]);
  const [projetos, setProjetos] = useState<{ id: string, projetoID: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string, nome: string }[]>([]);
  const { toast } = useToast();

  const fetchAuxiliaryData = async () => {
    // Fetch Categorias
    const { data: categoriasData } = await (supabase
      .from('categorias_financeiras') as any)
      .select('*')
      .eq('tipo', 'Receita')
      .order('nome');

    if (categoriasData) {
      setCategorias((categoriasData as any[]).map(cat => ({ id: cat.id, name: cat.nome })));
    }

    // Fetch Clientes
    const { data: clientesData } = await (supabase
      .from('clientes') as any)
      .select('*')
      .order('nome');

    if (clientesData) {
      setClientes((clientesData as any[]).map(c => ({ id: c.id, nome: c.nome })));
    }

    // Fetch Contas
    const { data: contasData } = await (supabase
      .from('contas') as any)
      .select('*')
      .order('nome');

    if (contasData) {
      setContas((contasData as any[]).map(c => ({ id: c.id, nome: c.nome })));
    }

    // Fetch Projetos
    const { data: projetosData } = await (supabase
      .from('projetos') as any)
      .select('id, nome, codigo_projeto')
      .order('nome');

    if (projetosData) {
      setProjetos((projetosData as any[]).map(p => ({ id: p.id, projetoID: p.codigo_projeto })));
    }
  };

  // Fetch Initial Data
  useEffect(() => {
    fetchReceitas();
    fetchAuxiliaryData();
  }, []);

  const fetchReceitas = async () => {
    console.log('[RECEITAS] Fetching receitas...');
    const { data, error } = await (supabase
      .from('receitas') as any)
      .select(`
        *,
        categorias_financeiras (nome),
        clientes (nome),
        projetos (codigo_projeto)
      `)
      .order('data_vencimento', { ascending: false });

    console.log('[RECEITAS] Fetch result:', { count: data?.length, error });

    if (error) {
      console.error('[RECEITAS] Error fetching:', error);
    }

    if (data) {
      const formattedData = (data as any[]).map((d: any) => ({
        ...d,
        categoria_nome: d.categorias_financeiras?.nome,
        cliente_nome: d.clientes?.nome,
        projeto_codigo: d.projetos?.codigo_projeto,
        data_recebimento: d.data_recebimento || d.data_vencimento
      }));
      console.log('[RECEITAS] Formatted data:', { count: formattedData.length, sample: formattedData[0] });
      setReceitas(formattedData);
    }
  };

  const handleCategoryChange = () => {
    fetchAuxiliaryData();
  };

  const openEditReceita = (receita: Receita) => {
    setSelectedReceita(receita);

    if (receita.data_vencimento) setDataVencimento(new Date(receita.data_vencimento));
    setDescricao(receita.descricao);
    setValorTotal(receita.valor.toString());
    setStatus(receita.status === 'Recebido' ? 'Recebida' : 'Pendente');
    setCategoriaId(receita.categoria_id || "");
    setProjetoID(receita.projeto_id || "");
    setNotaFiscal(receita.nota_fiscal || "");
    setContaId(receita.conta_id || "");
    setClienteId(receita.cliente_id || "");
    setObservacao(receita.observacao || "");
    setFormaPagamento(receita.forma_pagamento || "");
    setParcelas("1");

    setIsDetailOpen(false);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dataVencimento || !descricao || !valorTotal) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const numParcelas = parseInt(parcelas) || 1;
      const valorParcela = parseFloat(valorTotal) / numParcelas;
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado");

      const receitasToInsert = [];

      for (let i = 0; i < numParcelas; i++) {
        const dataParcela = addMonths(dataVencimento, i);
        const dataStr = format(dataParcela, 'yyyy-MM-dd');

        receitasToInsert.push({
          // user_id: user.id, // Not needed if trigger handles created_by
          data_vencimento: dataStr,
          data_recebimento: status === 'Recebida' ? dataStr : null,
          descricao: numParcelas > 1 ? `${descricao} (${i + 1}/${numParcelas})` : descricao,
          projeto_id: projetoID || null,
          categoria_id: categoriaId || null,
          valor: valorParcela, // Mapped to 'valor' in DB if using 'valor', but schema says 'valor'. Wait, types say 'valor_total'.
          // Types file says 'valor_total' for receitas table?
          // Let me check schema again.
          // Schema line 287: valor DECIMAL(12,2) NOT NULL.
          // Types file might be wrong. I should use 'valor' and cast to any if needed.
          // But wait, 'Receitas.tsx' previously used 'valor_total'.
          // I will use 'valor' as per schema.
          forma_pagamento: formaPagamento || null,
          nota_fiscal: notaFiscal || null,
          status: status === 'Recebida' ? 'Recebido' : 'Pendente', // Schema uses 'Recebido' (Past Participle) or 'Pendente'. Form uses 'Recebida'.
          conta_id: contaId || null,
          cliente_id: clienteId || null,
          observacao: observacao || null
        });
      }

      // Need to use 'valor' not 'valor_total' if schema says 'valor'.
      // I'll map it to 'valor' in the object. 
      // But I need to check if `receitas` table in types has `valor` or `valor_total`.
      // Types file says `valor_total` for `receitas`.
      // Schema says `valor`.
      // Since I can't regenerate types, I will cast insert to any.
      const dataToInsert = receitasToInsert.map(r => ({
        ...r,
        valor: r.valor // Ensure we use 'valor' column name
      }));

      let error = null;
      
      if (selectedReceita) {
        // Update existing receita
        ({ error } = await (supabase.from('receitas') as any)
          .update(dataToInsert[0])
          .eq('id', selectedReceita.id));
      } else {
        ({ error } = await (supabase.from('receitas') as any)
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
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setDataVencimento(new Date());
    setDescricao("");
    setProjetoID("");
    setCategoriaId("");
    setValorTotal("");
    setFormaPagamento("");
    setNotaFiscal("");
    setStatus("Recebida");
    setContaId("");
    setClienteId("");
    setObservacao("");
    setRecorrencia("Nenhuma");
    setParcelas("1");
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Receita
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Receita</DialogTitle>
                  <DialogDescription>
                    Cadastre uma nova receita no sistema
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <Label htmlFor="dataVencimento" className="text-xs">Data Vencimento *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal text-xs h-9",
                            !dataVencimento && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {dataVencimento ? format(dataVencimento, "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataVencimento}
                          onSelect={setDataVencimento}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="valorTotal" className="text-xs">Valor Total (R$) *</Label>
                    <Input
                      id="valorTotal"
                      type="number"
                      step="0.01"
                      value={valorTotal}
                      onChange={(e) => setValorTotal(e.target.value)}
                      placeholder="0,00"
                      required
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="status" className="text-xs">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Recebida">Recebida</SelectItem>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="parcelas" className="text-xs">Parcelas</Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="1"
                      value={parcelas}
                      onChange={(e) => setParcelas(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="descricao" className="text-xs">Descrição *</Label>
                    <Input
                      id="descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descreva a receita"
                      required
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="observacao" className="text-xs">Observação</Label>
                    <Input
                      id="observacao"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Observações adicionais"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="clienteId" className="text-xs">Cliente (Pagante)</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="projetoID" className="text-xs">Projeto</Label>
                    <Select value={projetoID} onValueChange={setProjetoID}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {projetos.map((proj) => (
                          <SelectItem key={proj.id} value={proj.id}>{proj.projetoID}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="categoriaId" className="text-xs">Categoria</Label>
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="formaPagamento" className="text-xs">Forma de Pagamento</Label>
                    <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                      <SelectTrigger className="h-9">
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

                  <div className="space-y-1">
                    <Label htmlFor="contaId" className="text-xs">Conta de Recebimento</Label>
                    <Select value={contaId} onValueChange={setContaId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {contas.map((conta) => (
                          <SelectItem key={conta.id} value={conta.id}>{conta.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="recorrencia" className="text-xs">Recorrência</Label>
                    <Select value={recorrencia} onValueChange={setRecorrencia}>
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

                  <div className="space-y-1">
                    <Label htmlFor="notaFiscal" className="text-xs">Nota Fiscal</Label>
                    <Select value={notaFiscal} onValueChange={setNotaFiscal}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-4 md:col-span-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white">
                      Salvar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
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
                {receitas.map((receita) => (
                  <TableRow
                    key={receita.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      setSelectedReceita(receita);
                      setIsDetailOpen(true);
                    }}
                  >
                    <TableCell>{format(new Date(receita.data_vencimento), "dd/MM/yyyy")}</TableCell>
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
        <DialogContent className="sm:max-w-md">
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
                  <Label className="text-xs text-muted-foreground">Vencimento</Label>
                  <p className="text-sm font-medium">{format(new Date(selectedReceita.data_vencimento), "dd/MM/yyyy")}</p>
                </div>
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
