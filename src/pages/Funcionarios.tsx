import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  admissao: string;
  demissao: string;
  salarioFixo: number;
  valorm2: number;
  celular: string;
  email: string;
  endereco: string;
}

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([
    {
      id: "1",
      nome: "Ana Costa",
      cpf: "987.654.321-00",
      cargo: "Arquiteta",
      admissao: "2023-01-15",
      demissao: "",
      salarioFixo: 8000,
      valorm2: 50,
      celular: "(11) 88888-8888",
      email: "ana@vrzengenharia.com",
      endereco: "Rua das Palmeiras, 456 - São Paulo, SP",
    },
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    cargo: "",
    admissao: "",
    demissao: "",
    salarioFixo: "",
    valorm2: "",
    celular: "",
    email: "",
    endereco: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Funcionario | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.cpf || !formData.cargo) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, CPF e cargo",
        variant: "destructive",
      });
      return;
    }

    const novoFuncionario: Funcionario = {
      id: Date.now().toString(),
      ...formData,
      salarioFixo: parseFloat(formData.salarioFixo) || 0,
      valorm2: parseFloat(formData.valorm2) || 0,
    };

    setFuncionarios([...funcionarios, novoFuncionario]);
    
    // Reset form
    setFormData({
      nome: "",
      cpf: "",
      cargo: "",
      admissao: "",
      demissao: "",
      salarioFixo: "",
      valorm2: "",
      celular: "",
      email: "",
      endereco: "",
    });
    setIsDialogOpen(false);
    
    toast({
      title: "Funcionário cadastrado",
      description: "Novo funcionário foi adicionado com sucesso",
    });
  };

  const isAtivo = (funcionario: Funcionario) => !funcionario.demissao;

  const handleSort = (field: keyof Funcionario) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedFuncionarios = useMemo(() => {
    let filtered = funcionarios.filter(funcionario => 
      funcionario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      funcionario.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) ||
      funcionario.cargo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [funcionarios, searchTerm, sortField, sortDirection]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Funcionários</h1>
          <p className="text-sm text-black/60 mt-1">Gerencie seus funcionários</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Funcionário</DialogTitle>
              <DialogDescription>
                Cadastre um novo funcionário no sistema
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => handleInputChange("cpf", e.target.value)}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo *</Label>
                <Input
                  id="cargo"
                  value={formData.cargo}
                  onChange={(e) => handleInputChange("cargo", e.target.value)}
                  placeholder="Ex: Arquiteto, Engenheiro"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="admissao">Admissão</Label>
                <Input
                  id="admissao"
                  type="date"
                  value={formData.admissao}
                  onChange={(e) => handleInputChange("admissao", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="demissao">Demissão</Label>
                <Input
                  id="demissao"
                  type="date"
                  value={formData.demissao}
                  onChange={(e) => handleInputChange("demissao", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="salarioFixo">Salário Fixo (R$)</Label>
                <Input
                  id="salarioFixo"
                  type="number"
                  step="0.01"
                  value={formData.salarioFixo}
                  onChange={(e) => handleInputChange("salarioFixo", e.target.value)}
                  placeholder="8000.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="valorm2">Valor por M² (R$)</Label>
                <Input
                  id="valorm2"
                  type="number"
                  step="0.01"
                  value={formData.valorm2}
                  onChange={(e) => handleInputChange("valorm2", e.target.value)}
                  placeholder="50.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="celular">Celular</Label>
                <Input
                  id="celular"
                  value={formData.celular}
                  onChange={(e) => handleInputChange("celular", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="nome@vrzengenharia.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange("endereco", e.target.value)}
                  placeholder="Endereço completo"
                />
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

      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Lista de Funcionários</CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">
                Total de {filteredAndSortedFuncionarios.length} de {funcionarios.length} funcionário(s)
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <Input
                placeholder="Buscar por nome, CPF ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('nome')} className="-ml-3 h-8 font-medium">
                      Nome
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('cpf')} className="-ml-3 h-8 font-medium">
                      CPF
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('cargo')} className="-ml-3 h-8 font-medium">
                      Cargo
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Salário</TableHead>
                  <TableHead className="hidden xl:table-cell">Valor/M²</TableHead>
                  <TableHead className="hidden md:table-cell">Contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedFuncionarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-black/50 py-8">
                      Nenhum funcionário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedFuncionarios.map((funcionario) => (
                    <TableRow key={funcionario.id}>
                      <TableCell className="font-medium">{funcionario.nome}</TableCell>
                      <TableCell>{funcionario.cpf}</TableCell>
                      <TableCell>{funcionario.cargo}</TableCell>
                      <TableCell>
                        <Badge className={isAtivo(funcionario) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {isAtivo(funcionario) ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">R$ {funcionario.salarioFixo.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="hidden xl:table-cell">R$ {funcionario.valorm2.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="hidden md:table-cell">{funcionario.celular}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}