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
import { CalendarIcon, Plus, Settings } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "@/components/CategoryManager";
import { SupplierManager } from "@/components/SupplierManager";
import { Badge } from "@/components/ui/badge";

interface Despesa {
  id: string;
  dataPagamento: Date;
  descricao: string;
  categoria: string;
  valorTotal: number;
  parcelas: number;
  formaPagamento: string;
  responsavel: string;
  fornecedor: string;
  projetoID: string;
  notaFiscal: string;
}

export default function Despesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([
    {
      id: "1",
      dataPagamento: new Date(),
      descricao: "Material de construção",
      categoria: "Materiais",
      valorTotal: 5000,
      parcelas: 1,
      formaPagamento: "Cartão",
      responsavel: "João Silva",
      fornecedor: "Construmega",
      projetoID: "PRJ001",
      notaFiscal: "Sim",
    },
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dataPagamento, setDataPagamento] = useState<Date>();
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [projetoID, setProjetoID] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [categorias, setCategorias] = useState<{id: string, name: string}[]>([]);
  const [fornecedores, setFornecedores] = useState<{id: string, name: string, contact?: string, email?: string, phone?: string}[]>([]);
  const [projetos, setProjetos] = useState<{id: string, projetoID: string}[]>([
    { id: "1", projetoID: "PRJ001" },
    { id: "2", projetoID: "PRJ002" },
    { id: "3", projetoID: "PRJ003" }
  ]);
  const { toast } = useToast();
  
  // Carregar categorias do localStorage
  useEffect(() => {
    const savedCategories = localStorage.getItem("vrz-financeiro-despesas-categorias");
    if (savedCategories) {
      setCategorias(JSON.parse(savedCategories));
    } else {
      // Categorias padrão
      const defaultCategories = [
        { id: "1", name: "Materiais" },
        { id: "2", name: "Pessoal" },
        { id: "3", name: "Equipamentos" },
        { id: "4", name: "Serviços" },
        { id: "5", name: "Impostos" },
      ];
      localStorage.setItem("vrz-financeiro-despesas-categorias", JSON.stringify(defaultCategories));
      setCategorias(defaultCategories);
    }
    
    // Carregar fornecedores do localStorage
    const savedSuppliers = localStorage.getItem("vrz-financeiro-suppliers");
    if (savedSuppliers) {
      setFornecedores(JSON.parse(savedSuppliers));
    }
    
    // Carregar projetos do localStorage
    const savedProjects = localStorage.getItem("vrz-financeiro-projetos");
    if (savedProjects) {
      const projectsData = JSON.parse(savedProjects);
      const projectsList = projectsData.map((proj: any) => ({
        id: proj.id,
        projetoID: proj.projetoID
      }));
      setProjetos(projectsList);
    }
  }, []);
  
  // Atualizar categorias quando forem alteradas pelo CategoryManager
  const handleCategoryChange = (newCategories: {id: string, name: string}[]) => {
    setCategorias(newCategories);
  };
  
  // Atualizar fornecedores quando forem alterados pelo SupplierManager
  const handleSupplierChange = (newSuppliers: {id: string, name: string, contact?: string, email?: string, phone?: string}[]) => {
    setFornecedores(newSuppliers);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dataPagamento || !descricao || !valorTotal) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const novaDespesa: Despesa = {
      id: Date.now().toString(),
      dataPagamento,
      descricao,
      categoria,
      valorTotal: parseFloat(valorTotal),
      parcelas: parseInt(parcelas || "1"),
      formaPagamento,
      responsavel,
      fornecedor,
      projetoID,
      notaFiscal,
    };

    setDespesas([...despesas, novaDespesa]);
    
    // Reset form
    setDataPagamento(undefined);
    setDescricao("");
    setCategoria("");
    setValorTotal("");
    setParcelas("");
    setFormaPagamento("");
    setResponsavel("");
    setFornecedor("");
    setProjetoID("");
    setNotaFiscal("");
    setIsDialogOpen(false);
    
    toast({
      title: "Despesa cadastrada",
      description: "Nova despesa foi adicionada com sucesso",
    });
  };

  return (
    <div className="space-y-8 w-full max-w-none">
      <div className="flex justify-end items-center">
        <div className="flex gap-2">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
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
                    storageKey="vrz-financeiro-despesas-categorias"
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
                  <Label htmlFor="dataPagamento" className="text-xs">Data *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-xs h-9",
                          !dataPagamento && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {dataPagamento ? format(dataPagamento, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataPagamento}
                        onSelect={setDataPagamento}
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
                
                <div className="space-y-1">
                  <Label htmlFor="parcelas" className="text-xs">Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    value={parcelas}
                    onChange={(e) => setParcelas(e.target.value)}
                    placeholder="1"
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
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="categoria" className="text-xs">Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="fornecedor" className="text-xs">Fornecedor</Label>
                  <Select value={fornecedor} onValueChange={setFornecedor}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((forn) => (
                        <SelectItem key={forn.id} value={forn.name}>{forn.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="projetoID" className="text-xs">ID do Projeto</Label>
                  <Select value={projetoID} onValueChange={setProjetoID}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos.map((proj) => (
                        <SelectItem key={proj.id} value={proj.projetoID}>{proj.projetoID}</SelectItem>
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
                
                <div className="space-y-1">
                  <Label htmlFor="responsavel" className="text-xs">Responsável</Label>
                  <Input
                    id="responsavel"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    placeholder="Nome do responsável"
                    className="h-9"
                  />
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
      </div>

      <Card className="rounded-2xl border border-black/10 bg-white p-6 w-full">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg font-medium tracking-tight">Lista de Despesas</CardTitle>
          <CardDescription className="text-sm text-black/60 mt-1">
            Total de {despesas.length} despesa(s) cadastrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Nota Fiscal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesas.map((despesa) => (
                <TableRow key={despesa.id}>
                  <TableCell>{format(despesa.dataPagamento, "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{despesa.descricao}</TableCell>
                  <TableCell>{despesa.categoria}</TableCell>
                  <TableCell className="text-red-600 font-medium">
                    R$ {despesa.valorTotal.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>{despesa.parcelas}x</TableCell>
                  <TableCell>{despesa.responsavel}</TableCell>
                  <TableCell>{despesa.fornecedor}</TableCell>
                  <TableCell>{despesa.projetoID}</TableCell>
                  <TableCell>
                    <Badge variant={despesa.notaFiscal === "Sim" ? "default" : "outline"} className={despesa.notaFiscal === "Sim" ? "bg-green-500" : ""}>
                      {despesa.notaFiscal}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
