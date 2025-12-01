import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Projeto {
  id: string;
  projetoID: string;
  cliente: string;
  localizacao: string;
  placa: string;
  post: string;
  dataInicio: string;
  dataPrevisao: string;
  dataFinal: string;
  contrato: string;
  status: string;
  briefing: string;
  arquiteto: string;
  tipo: string;
  pacote: string;
  m2: number;
  parcelas: number;
  valorTotal: number;
  responsavelEletrico: string;
  responsavelHidraulico: string;
  responsavelModelagem: string;
  responsavelDetalhamento: string;
}

export default function Projetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([
    {
      id: "1",
      projetoID: "PRJ001",
      cliente: "João Silva",
      localizacao: "São Paulo, SP",
      placa: "Sim",
      post: "Sim",
      dataInicio: "2024-01-15",
      dataPrevisao: "2024-03-15",
      dataFinal: "",
      contrato: "Sim",
      status: "Em Andamento",
      briefing: "Sim",
      arquiteto: "Ana Costa",
      tipo: "Residencial",
      pacote: "Completo",
      m2: 150,
      parcelas: 3,
      valorTotal: 45000,
      responsavelEletrico: "Carlos Lima",
      responsavelHidraulico: "Maria Santos",
      responsavelModelagem: "Pedro Oliveira",
      responsavelDetalhamento: "Luciana Torres",
    },
  ]);
  
  const [clientes, setClientes] = useState<{id: string, nome: string}[]>([
    { id: "1", nome: "João Silva" },
    { id: "2", nome: "Maria Santos" },
    { id: "3", nome: "Carlos Pereira" },
  ]);
  
  const [funcionarios, setFuncionarios] = useState<{id: string, nome: string, cargo: string}[]>([
    { id: "1", nome: "Ana Costa", cargo: "Arquiteta" },
    { id: "2", nome: "Carlos Lima", cargo: "Engenheiro Elétrico" },
    { id: "3", nome: "Maria Santos", cargo: "Engenheira Hidráulica" },
    { id: "4", nome: "Pedro Oliveira", cargo: "Modelagem 3D" },
    { id: "5", nome: "Luciana Torres", cargo: "Detalhamento" },
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    projetoID: "",
    cliente: "",
    localizacao: "",
    placa: "",
    post: "",
    dataInicio: "",
    dataPrevisao: "",
    dataFinal: "",
    contrato: "",
    status: "",
    briefing: "",
    arquiteto: "",
    tipo: "",
    pacote: "",
    m2: "",
    parcelas: "",
    valorTotal: "",
    responsavelEletrico: "",
    responsavelHidraulico: "",
    responsavelModelagem: "",
    responsavelDetalhamento: "",
  });
  const { toast } = useToast();
  
  useEffect(() => {
    // Carregar clientes do localStorage
    const savedClientes = localStorage.getItem("vrz-financeiro-clientes");
    if (savedClientes) {
      const clientesData = JSON.parse(savedClientes);
      const clientesList = clientesData.map((cliente: any) => ({
        id: cliente.id,
        nome: cliente.nome
      }));
      setClientes(clientesList);
    }
    
    // Carregar funcionários do localStorage
    const savedFuncionarios = localStorage.getItem("vrz-financeiro-funcionarios");
    if (savedFuncionarios) {
      const funcionariosData = JSON.parse(savedFuncionarios);
      const funcionariosList = funcionariosData.map((func: any) => ({
        id: func.id,
        nome: func.nome,
        cargo: func.cargo
      }));
      setFuncionarios(funcionariosList);
    }
    
    // Salvar projetos no localStorage
    localStorage.setItem("vrz-financeiro-projetos", JSON.stringify(projetos));
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projetoID || !formData.cliente) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos o ID do projeto e cliente",
        variant: "destructive",
      });
      return;
    }

    const novoProjeto: Projeto = {
      id: Date.now().toString(),
      ...formData,
      m2: parseFloat(formData.m2) || 0,
      parcelas: parseInt(formData.parcelas) || 1,
      valorTotal: parseFloat(formData.valorTotal) || 0,
    };

    setProjetos([...projetos, novoProjeto]);
    
    // Reset form
    setFormData({
      projetoID: "",
      cliente: "",
      localizacao: "",
      placa: "",
      post: "",
      dataInicio: "",
      dataPrevisao: "",
      dataFinal: "",
      contrato: "",
      status: "",
      briefing: "",
      arquiteto: "",
      tipo: "",
      pacote: "",
      m2: "",
      parcelas: "",
      valorTotal: "",
      responsavelEletrico: "",
      responsavelHidraulico: "",
      responsavelModelagem: "",
      responsavelDetalhamento: "",
    });
    setIsDialogOpen(false);
    
    toast({
      title: "Projeto cadastrado",
      description: "Novo projeto foi adicionado com sucesso",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      "Em Andamento": "bg-blue-100 text-blue-800",
      "Concluído": "bg-green-100 text-green-800",
      "Pausado": "bg-yellow-100 text-yellow-800",
      "Cancelado": "bg-red-100 text-red-800",
    };
    return statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Projetos</h1>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm md:max-w-md lg:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Projeto</DialogTitle>
              <DialogDescription>
                Cadastre um novo projeto no sistema
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projetoID">Projeto ID *</Label>
                  <Input
                    id="projetoID"
                    value={formData.projetoID}
                    onChange={(e) => handleInputChange("projetoID", e.target.value)}
                    placeholder="PRJ001"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select 
                    value={formData.cliente} 
                    onValueChange={(value) => handleInputChange("cliente", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.nome}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="localizacao">Localização</Label>
                  <Input
                    id="localizacao"
                    value={formData.localizacao}
                    onChange={(e) => handleInputChange("localizacao", e.target.value)}
                    placeholder="Cidade, Estado"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="placa">Placa</Label>
                  <Select 
                    value={formData.placa} 
                    onValueChange={(value) => handleInputChange("placa", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Possui placa?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="post">Post</Label>
                  <Select 
                    value={formData.post} 
                    onValueChange={(value) => handleInputChange("post", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Possui post?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={formData.dataInicio}
                    onChange={(e) => handleInputChange("dataInicio", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dataPrevisao">Data Previsão</Label>
                  <Input
                    id="dataPrevisao"
                    type="date"
                    value={formData.dataPrevisao}
                    onChange={(e) => handleInputChange("dataPrevisao", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dataFinal">Data Final</Label>
                  <Input
                    id="dataFinal"
                    type="date"
                    value={formData.dataFinal}
                    onChange={(e) => handleInputChange("dataFinal", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contrato">Contrato</Label>
                  <Select 
                    value={formData.contrato} 
                    onValueChange={(value) => handleInputChange("contrato", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Possui contrato?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                      <SelectItem value="Pausado">Pausado</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="arquiteto">Arquiteto</Label>
                  <Input
                    id="arquiteto"
                    value={formData.arquiteto}
                    onChange={(e) => handleInputChange("arquiteto", e.target.value)}
                    placeholder="Nome do arquiteto"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(value) => handleInputChange("tipo", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo do projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Residencial">Residencial</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                      <SelectItem value="Industrial">Industrial</SelectItem>
                      <SelectItem value="Institucional">Institucional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pacote">Pacote</Label>
                  <Select value={formData.pacote} onValueChange={(value) => handleInputChange("pacote", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo do pacote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Básico">Básico</SelectItem>
                      <SelectItem value="Intermediário">Intermediário</SelectItem>
                      <SelectItem value="Completo">Completo</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="m2">M²</Label>
                  <Input
                    id="m2"
                    type="number"
                    value={formData.m2}
                    onChange={(e) => handleInputChange("m2", e.target.value)}
                    placeholder="150"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="parcelas">Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    value={formData.parcelas}
                    onChange={(e) => handleInputChange("parcelas", e.target.value)}
                    placeholder="3"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="valorTotal">Valor Total (R$)</Label>
                  <Input
                    id="valorTotal"
                    type="number"
                    step="0.01"
                    value={formData.valorTotal}
                    onChange={(e) => handleInputChange("valorTotal", e.target.value)}
                    placeholder="45000.00"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="briefing">Briefing</Label>
                <Select 
                  value={formData.briefing} 
                  onValueChange={(value) => handleInputChange("briefing", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Possui briefing?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsavelEletrico">Responsável Elétrico</Label>
                  <Select 
                    value={formData.responsavelEletrico} 
                    onValueChange={(value) => handleInputChange("responsavelEletrico", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((func) => (
                        <SelectItem key={func.id} value={func.nome}>
                          {func.nome} - {func.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="responsavelHidraulico">Responsável Hidráulico</Label>
                  <Select 
                    value={formData.responsavelHidraulico} 
                    onValueChange={(value) => handleInputChange("responsavelHidraulico", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((func) => (
                        <SelectItem key={func.id} value={func.nome}>
                          {func.nome} - {func.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="responsavelModelagem">Responsável Modelagem</Label>
                  <Select 
                    value={formData.responsavelModelagem} 
                    onValueChange={(value) => handleInputChange("responsavelModelagem", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((func) => (
                        <SelectItem key={func.id} value={func.nome}>
                          {func.nome} - {func.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="responsavelDetalhamento">Responsável Detalhamento</Label>
                  <Select 
                    value={formData.responsavelDetalhamento} 
                    onValueChange={(value) => handleInputChange("responsavelDetalhamento", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((func) => (
                        <SelectItem key={func.id} value={func.nome}>
                          {func.nome} - {func.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
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

      <Card className="rounded-2xl border border-black/10 bg-white p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg font-medium tracking-tight">Lista de Projetos</CardTitle>
          <CardDescription className="text-sm text-black/60 mt-1">
            Total de {projetos.length} projeto(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>M²</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Arquiteto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetos.map((projeto) => (
                <TableRow key={projeto.id}>
                  <TableCell className="font-medium">{projeto.projetoID}</TableCell>
                  <TableCell>{projeto.cliente}</TableCell>
                  <TableCell>{projeto.localizacao}</TableCell>
                  <TableCell>
                    <Badge className={getStatusBadge(projeto.status)}>
                      {projeto.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{projeto.tipo}</TableCell>
                  <TableCell>{projeto.m2} m²</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    R$ {projeto.valorTotal.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>{projeto.arquiteto}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}