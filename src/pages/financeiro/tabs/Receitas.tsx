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
import { Badge } from "@/components/ui/badge";

interface Receita {
  id: string;
  dataRecebimento: Date;
  descricao: string;
  projetoID: string;
  categoria: string;
  valorTotal: number;
  formaPagamento: string;
  notaFiscal: string;
}

export default function Receitas() {
  const [receitas, setReceitas] = useState<Receita[]>([
    {
      id: "1",
      dataRecebimento: new Date(),
      descricao: "Projeto Casa Silva",
      projetoID: "PRJ001",
      categoria: "Projeto Arquitetônico",
      valorTotal: 15000,
      formaPagamento: "PIX",
      notaFiscal: "Sim",
    },
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dataRecebimento, setDataRecebimento] = useState<Date>();
  const [descricao, setDescricao] = useState("");
  const [projetoID, setProjetoID] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [categorias, setCategorias] = useState<{id: string, name: string}[]>([]);
  const [projetos, setProjetos] = useState<{id: string, projetoID: string}[]>([
    { id: "1", projetoID: "PRJ001" },
    { id: "2", projetoID: "PRJ002" },
    { id: "3", projetoID: "PRJ003" }
  ]);
  const { toast } = useToast();
  
  // Carregar categorias do localStorage
  useEffect(() => {
    const savedCategories = localStorage.getItem("vrz-financeiro-receitas-categorias");
    if (savedCategories) {
      setCategorias(JSON.parse(savedCategories));
    } else {
      // Categorias padrão
      const defaultCategories = [
        { id: "1", name: "Projeto Arquitetônico" },
        { id: "2", name: "Projeto Estrutural" },
        { id: "3", name: "Projeto Hidráulico" },
        { id: "4", name: "Projeto Elétrico" },
        { id: "5", name: "Consultoria" },
      ];
      localStorage.setItem("vrz-financeiro-receitas-categorias", JSON.stringify(defaultCategories));
      setCategorias(defaultCategories);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dataRecebimento || !descricao || !valorTotal) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const novaReceita: Receita = {
      id: Date.now().toString(),
      dataRecebimento,
      descricao,
      projetoID,
      categoria,
      valorTotal: parseFloat(valorTotal),
      formaPagamento,
      notaFiscal,
    };

    setReceitas([...receitas, novaReceita]);
    
    // Reset form
    setDataRecebimento(undefined);
    setDescricao("");
    setProjetoID("");
    setCategoria("");
    setValorTotal("");
    setFormaPagamento("");
    setNotaFiscal("");
    setIsDialogOpen(false);
    
    toast({
      title: "Receita cadastrada",
      description: "Nova receita foi adicionada com sucesso",
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
                    storageKey="vrz-financeiro-receitas-categorias"
                    onCategoryChange={handleCategoryChange}
                  />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
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
                <Label htmlFor="dataRecebimento" className="text-xs">Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs h-9",
                        !dataRecebimento && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dataRecebimento ? format(dataRecebimento, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataRecebimento}
                      onSelect={setDataRecebimento}
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
                  placeholder="Descreva a receita"
                  required
                  className="h-9"
                />
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
              
              <div className="flex gap-2 pt-4 md:col-span-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 vrz-button-primary">
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
          <CardTitle className="text-lg font-medium tracking-tight">Lista de Receitas</CardTitle>
          <CardDescription className="text-sm text-black/60 mt-1">
            Total de {receitas.length} receita(s) cadastrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>NF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receitas.map((receita) => (
                <TableRow key={receita.id}>
                  <TableCell>{format(receita.dataRecebimento, "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{receita.descricao}</TableCell>
                  <TableCell>{receita.projetoID}</TableCell>
                  <TableCell>{receita.categoria}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    R$ {receita.valorTotal.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>{receita.formaPagamento}</TableCell>
                  <TableCell>
                    <Badge variant={receita.notaFiscal === "Sim" ? "default" : "outline"} className={receita.notaFiscal === "Sim" ? "bg-green-500" : ""}>
                      {receita.notaFiscal}
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