import { useState, useEffect, useMemo } from "react";
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
import { format, addMonths, setDate } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "@/components/CategoryManager";
import { SupplierManager } from "@/components/SupplierManager";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface Despesa {
  id: string;
  data_vencimento: string;
  data_pagamento?: string;
  descricao: string;
  categoria_id: string | null;
  categoria_nome?: string; // Joined
  valor: number;
  status: string;
  projeto_id: string | null;
  projeto_codigo?: string;
  nota_fiscal: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  observacao: string | null;
  fornecedor_id: string | null;
  fornecedor_nome?: string;
  forma_pagamento?: string;
  created_by?: string; // user uuid
}

export default function Despesas() {
  const [despesasRaw, setDespesasRaw] = useState<Despesa[]>([]);
  const [contas, setContas] = useState<{id: string, nome: string}[]>([]);
  const [cartoes, setCartoes] = useState<{id: string, nome: string, dia_fechamento: number}[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);
  
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === 'admin';

  // Form States
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [projetoID, setProjetoID] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [status, setStatus] = useState("Pago");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [recorrencia, setRecorrencia] = useState("Nenhuma");

  const [categorias, setCategorias] = useState<{id: string, name: string}[]>([]);
  const [fornecedores, setFornecedores] = useState<{id: string, name: string}[]>([]);
  const [projetos, setProjetos] = useState<{id: string, projetoID: string}[]>([]);
  const { toast } = useToast();
  
  const fetchData = async () => {
    try {
      console.log('[DESPESAS] Fetching all data...');
      const [
        { data: categoriasData },
        { data: fornecedoresData },
        { data: contasData },
        { data: cartoesData },
        { data: projetosData },
        { data: despesasData, error: despesasError }
      ] = await Promise.all([
        (supabase.from('categorias_financeiras') as any).select('id, nome').eq('tipo', 'Despesa').order('nome'),
        (supabase.from('fornecedores') as any).select('id, nome').order('nome'),
        (supabase.from('contas') as any).select('id, nome'),
        (supabase.from('cartoes_credito') as any).select('id, nome, dia_fechamento'),
        (supabase.from('projetos') as any).select('id, nome, codigo_projeto').order('nome'),
        (supabase.from('despesas') as any).select(`
          *,
          projetos (codigo_projeto),
          fornecedores (nome)
        `).order('data_vencimento', { ascending: true })
      ]);

      console.log('[DESPESAS] Fetch results:', { 
        despesas: despesasData?.length,
        despesasError,
        categorias: categoriasData?.length,
        fornecedores: fornecedoresData?.length,
        contas: contasData?.length,
        cartoes: cartoesData?.length
      });

      if (categoriasData) setCategorias(categoriasData.map((c: any) => ({ id: c.id, name: c.nome })));
      if (fornecedoresData) setFornecedores(fornecedoresData.map((s: any) => ({ id: s.id, name: s.nome })));
      if (contasData) setContas(contasData);
      if (cartoesData) setCartoes(cartoesData);
      if (projetosData) setProjetos(projetosData.map((p: any) => ({ id: p.id, projetoID: p.codigo_projeto })));
      if (despesasData) {
        console.log('[DESPESAS] Setting despesas:', { count: despesasData.length, sample: despesasData[0] });
        setDespesasRaw(despesasData);
      }

    } catch (error) {
      console.error("[DESPESAS] Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as informações financeiras.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const despesas = useMemo(() => {
    return despesasRaw.map((d: any) => {
      // Derive payment method
      let forma = "-";
      if (d.cartao_id) forma = "Cartão de Crédito";
      else if (d.conta_id) forma = "Conta/Outro";

      return {
        ...d,
        categoria_nome: categorias.find(c => c.id === d.categoria_id)?.name || d.categoria_id,
        data_pagamento: d.data_pagamento || d.data_vencimento,
        projeto_codigo: d.projetos?.codigo_projeto,
        fornecedor_nome: d.fornecedores?.nome,
        forma_pagamento: forma
      };
    });
  }, [despesasRaw, categorias]);

  const handleCategoryChange = () => {
    fetchData();
  };
  
  const handleSupplierChange = () => {
    fetchData();
  };

  const openEditDespesa = (despesa: Despesa) => {
    setSelectedDespesa(despesa);
    
    if (despesa.data_vencimento) setDataVencimento(new Date(despesa.data_vencimento));
    setDescricao(despesa.descricao);
    setValorTotal(despesa.valor.toString());
    setStatus(despesa.status);
    setCategoriaId(despesa.categoria_id || "");
    setProjetoID(despesa.projeto_id || "");
    setNotaFiscal(despesa.nota_fiscal || "");
    setContaId(despesa.conta_id || "");
    setCartaoId(despesa.cartao_id || "");
    setObservacao(despesa.observacao || "");
    setFornecedorId(despesa.fornecedor_id || "");
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

    if (status === 'Pago' && !contaId && !cartaoId) {
       toast({
        title: "Origem do pagamento",
        description: "Para despesas pagas, selecione a Conta ou Cartão de Crédito.",
        variant: "destructive",
      });
      return;
    }

    try {
      const numParcelas = parseInt(parcelas) || 1;
      const valorParcela = parseFloat(valorTotal) / numParcelas;
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado");

      const despesasToInsert = [];
      
      // Logic for Credit Card Date
      let initialDate = new Date(dataVencimento);
      if (formaPagamento === "Cartão de Crédito" && cartaoId) {
        const card = cartoes.find(c => c.id === cartaoId);
        if (card) {
          const dayOfPurchase = initialDate.getDate();
          if (dayOfPurchase > card.dia_fechamento) {
            // Move to next month if after closing date
            initialDate = addMonths(initialDate, 1);
          }
        }
      }

      for (let i = 0; i < numParcelas; i++) {
        const dataParcela = addMonths(initialDate, i);
        const dataStr = format(dataParcela, 'yyyy-MM-dd');
        
        despesasToInsert.push({
          // user_id: user.id, 
          data_vencimento: dataStr,
          data_pagamento: status === 'Pago' ? dataStr : null,
          descricao: numParcelas > 1 ? `${descricao} (${i + 1}/${numParcelas})` : descricao,
          categoria_id: categoriaId || null,
          valor: valorParcela,
          fornecedor_id: fornecedorId || null,
          projeto_id: projetoID || null,
          nota_fiscal: notaFiscal || null,
          status: status === 'Pago' ? 'Pago' : 'Pendente',
          conta_id: contaId || null,
          cartao_id: cartaoId || null,
          observacao: observacao || null, 
        });
      }

      const { error } = await (supabase.from('despesas') as any).insert(despesasToInsert);

      if (error) throw error;

      toast({
        title: "Despesa cadastrada",
        description: `${numParcelas} registro(s) criado(s) com sucesso`,
      });

      setIsDialogOpen(false);
      fetchData();
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
    setCategoriaId("");
    setValorTotal("");
    setParcelas("1");
    setFormaPagamento("");
    setFornecedorId("");
    setProjetoID("");
    setNotaFiscal("");
    setStatus("Pago");
    setContaId("");
    setCartaoId("");
    setObservacao("");
    setRecorrencia("Nenhuma");
  };
  
  const handleDelete = async (id: string) => {
     const { error } = await supabase.from('despesas').delete().eq('id', id);
    if (!error) {
      toast({ title: "Despesa excluída" });
      fetchData();
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
                  <DialogDescription>
                    Gerencie as categorias de despesas e fornecedores
                  </DialogDescription>
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
                    <SupplierManager 
                      onSupplierChange={handleSupplierChange}
                    />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Despesa</DialogTitle>
                  <DialogDescription>
                    Cadastre uma nova despesa no sistema
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <Label htmlFor="dataVencimento" className="text-xs">Data *</Label>
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
                    <Label htmlFor="valorTotal" className="text-xs">Valor (R$) *</Label>
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
                        <SelectItem value="Pago">Pago</SelectItem>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="descricao" className="text-xs">Descrição *</Label>
                    <Input
                      id="descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descreva a despesa"
                      required
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="observacao" className="text-xs">Observação / Conta Destino</Label>
                    <Input
                      id="observacao"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Observações adicionais"
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="formaPagamento" className="text-xs">Forma de Pagamento</Label>
                    <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Transferência">Transferência</SelectItem>
                        <SelectItem value="Boleto">Boleto</SelectItem>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formaPagamento === "Cartão de Crédito" ? (
                    <div className="space-y-1">
                      <Label htmlFor="cartaoId" className="text-xs">Cartão de Crédito</Label>
                      <Select value={cartaoId} onValueChange={setCartaoId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione o cartão" />
                        </SelectTrigger>
                        <SelectContent>
                          {cartoes.map((cartao) => (
                            <SelectItem key={cartao.id} value={cartao.id}>{cartao.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                     <div className="space-y-1">
                      <Label htmlFor="contaId" className="text-xs">Conta de Saída</Label>
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
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="parcelas" className="text-xs">Parcelas</Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="1"
                      value={parcelas}
                      onChange={(e) => setParcelas(e.target.value)}
                      placeholder="1"
                      className="h-9"
                    />
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
                    <Label htmlFor="fornecedorId" className="text-xs">Fornecedor</Label>
                    <Select value={fornecedorId} onValueChange={setFornecedorId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores.map((forn) => (
                          <SelectItem key={forn.id} value={forn.id}>{forn.name}</SelectItem>
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
                  
                  <div className="flex gap-2 pt-3 md:col-span-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-9">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 vrz-button-primary h-9">
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
              {despesas.map((despesa: any) => (
                <TableRow key={despesa.id} className="cursor-pointer hover:bg-gray-50" onClick={() => {
                    setSelectedDespesa(despesa);
                    setIsDetailOpen(true);
                  }}>
                  <TableCell>{format(new Date(despesa.data_vencimento), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{despesa.descricao}</TableCell>
                  <TableCell>{despesa.fornecedor_nome || "-"}</TableCell>
                  <TableCell>{despesa.projeto_codigo || "-"}</TableCell>
                  <TableCell>{despesa.categoria_nome || "-"}</TableCell>
                  <TableCell>{despesa.forma_pagamento}</TableCell>
                  <TableCell>1</TableCell>
                  <TableCell className="text-red-600 font-medium">
                    R$ {despesa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={despesa.status === 'Pago' ? 'default' : 'secondary'} className={despesa.status === 'Pago' ? 'bg-green-500' : ''}>
                      {despesa.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={despesa.nota_fiscal === "Sim" ? "default" : "outline"} className={despesa.nota_fiscal === "Sim" ? "bg-green-500" : ""}>
                      {despesa.nota_fiscal || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEditDespesa(despesa)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(despesa.id)}>
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
            <DialogTitle>Detalhes da Despesa</DialogTitle>
            <DialogDescription>
              Informações completas da despesa selecionada
            </DialogDescription>
          </DialogHeader>
          
          {selectedDespesa && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Vencimento</Label>
                  <p className="text-sm font-medium">{format(new Date(selectedDespesa.data_vencimento), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <p className="text-sm font-bold text-red-600">R$ {selectedDespesa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <p className="text-sm font-medium">{selectedDespesa.descricao}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="text-sm">{selectedDespesa.status}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <p className="text-sm">{selectedDespesa.categoria_nome || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                  <p className="text-sm">{selectedDespesa.fornecedor_nome || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Projeto</Label>
                  <p className="text-sm">{selectedDespesa.projeto_codigo || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Forma de Pagamento</Label>
                  <p className="text-sm">{selectedDespesa.forma_pagamento || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Conta / Cartão</Label>
                  <p className="text-sm">
                    {selectedDespesa.conta_id 
                      ? contas.find(c => c.id === selectedDespesa.conta_id)?.nome 
                      : selectedDespesa.cartao_id 
                        ? cartoes.find(c => c.id === selectedDespesa.cartao_id)?.nome 
                        : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nota Fiscal</Label>
                  <p className="text-sm">{selectedDespesa.nota_fiscal || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Parcela</Label>
                  <p className="text-sm">1</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Observação</Label>
                  <p className="text-sm">{selectedDespesa.observacao || "-"}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 mt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setIsDetailOpen(false)}>
                  Fechar
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => openEditDespesa(selectedDespesa)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => {
                      handleDelete(selectedDespesa.id);
                      setIsDetailOpen(false);
                    }}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
