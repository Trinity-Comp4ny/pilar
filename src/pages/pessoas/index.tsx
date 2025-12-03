import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ArrowUpDown, User, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";

interface Pessoa {
  id: string;
  nome: string;
  cpf_cnpj: string;
  tipo: "contratado" | "terceirizado";
  cargo: string;
  admissao: string;
  demissao: string;
  salarioFixo: number;
  valorm2: number;
  celular: string;
  email: string;
  endereco: string;
}

export default function Pessoas() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([
    {
      id: "1",
      nome: "Ana Costa",
      cpf_cnpj: "987.654.321-00",
      tipo: "contratado",
      cargo: "Arquiteta",
      admissao: "2023-01-15",
      demissao: "",
      salarioFixo: 8000,
      valorm2: 50,
      celular: "(11) 88888-8888",
      email: "ana@vrzengenharia.com",
      endereco: "Rua das Palmeiras, 456 - São Paulo, SP",
    },
    {
      id: "2",
      nome: "Carlos Empreiteira",
      cpf_cnpj: "12.345.678/0001-90",
      tipo: "terceirizado",
      cargo: "Empreiteiro",
      admissao: "2023-06-10",
      demissao: "",
      salarioFixo: 0,
      valorm2: 120,
      celular: "(11) 97777-7777",
      email: "carlos@empreiteira.com",
      endereco: "Av. Industrial, 1000 - São Paulo, SP",
    }
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cpf_cnpj: "",
    tipo: "contratado",
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
  const [filterCargo, setFilterCargo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [sortField, setSortField] = useState<keyof Pessoa | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.cpf_cnpj || !formData.cargo) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, CPF/CNPJ e cargo",
        variant: "destructive",
      });
      return;
    }

    const novaPessoa: Pessoa = {
      id: Date.now().toString(),
      ...formData,
      tipo: formData.tipo as "contratado" | "terceirizado",
      salarioFixo: parseFloat(formData.salarioFixo) || 0,
      valorm2: parseFloat(formData.valorm2) || 0,
    };

    setPessoas([...pessoas, novaPessoa]);
    
    // Reset form
    setFormData({
      nome: "",
      cpf_cnpj: "",
      tipo: "contratado",
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
      title: "Pessoa cadastrada",
      description: "Nova pessoa foi adicionada com sucesso",
    });
  };

  const isAtivo = (pessoa: Pessoa) => !pessoa.demissao;

  const handleSort = (field: keyof Pessoa) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (pessoa: Pessoa) => {
    setSelectedPessoa(pessoa);
    setIsDetailOpen(true);
  };

  const cargos = useMemo(() => {
    const uniqueCargos = Array.from(new Set(pessoas.map(p => p.cargo)));
    return uniqueCargos;
  }, [pessoas]);

  const filteredAndSortedPessoas = useMemo(() => {
    let filtered = pessoas.filter(pessoa => 
      (pessoa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoa.cpf_cnpj.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) ||
      pessoa.cargo.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterCargo === "todos" || pessoa.cargo === filterCargo) &&
      (filterStatus === "todos" || (filterStatus === "ativo" ? isAtivo(pessoa) : !isAtivo(pessoa)))
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
  }, [pessoas, searchTerm, filterCargo, filterStatus, sortField, sortDirection]);

  return (
    <PageLayout
      header={
        <PageHeader 
          title="Pessoas" 
          description="Gerencie funcionários e terceirizados"
          children={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Pessoa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Pessoa</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo funcionário ou terceirizado
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tipo">Tipo de Contrato *</Label>
                    <Select 
                      value={formData.tipo} 
                      onValueChange={(value) => handleInputChange("tipo", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contratado">Contratado (CLT/PJ)</SelectItem>
                        <SelectItem value="terceirizado">Terceirizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
                    <Label htmlFor="cpf_cnpj">{formData.tipo === 'terceirizado' ? 'CPF ou CNPJ *' : 'CPF *'}</Label>
                    <Input
                      id="cpf_cnpj"
                      value={formData.cpf_cnpj}
                      onChange={(e) => handleInputChange("cpf_cnpj", e.target.value)}
                      placeholder={formData.tipo === 'terceirizado' ? "00.000.000/0000-00" : "000.000.000-00"}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cargo">Cargo/Função *</Label>
                    <Input
                      id="cargo"
                      value={formData.cargo}
                      onChange={(e) => handleInputChange("cargo", e.target.value)}
                      placeholder="Ex: Arquiteto, Pedreiro"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="email@exemplo.com"
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
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => handleInputChange("endereco", e.target.value)}
                      placeholder="Endereço completo"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="admissao">Início/Admissão</Label>
                    <Input
                      id="admissao"
                      type="date"
                      value={formData.admissao}
                      onChange={(e) => handleInputChange("admissao", e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="demissao">Fim/Demissão</Label>
                    <Input
                      id="demissao"
                      type="date"
                      value={formData.demissao}
                      onChange={(e) => handleInputChange("demissao", e.target.value)}
                    />
                  </div>
                  
                  {formData.tipo === 'contratado' && (
                    <div className="space-y-2">
                      <Label htmlFor="salarioFixo">Salário Fixo (R$)</Label>
                      <Input
                        id="salarioFixo"
                        type="number"
                        step="0.01"
                        value={formData.salarioFixo}
                        onChange={(e) => handleInputChange("salarioFixo", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="valorm2">Valor por M² (R$)</Label>
                    <Input
                      id="valorm2"
                      type="number"
                      step="0.01"
                      value={formData.valorm2}
                      onChange={(e) => handleInputChange("valorm2", e.target.value)}
                      placeholder="0.00"
                    />
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
          }
        />
      }
    >
      <Card className="rounded-2xl border border-black/5 bg-white w-full">
        <CardHeader>
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-medium tracking-tight">Lista de Pessoas</CardTitle>
                <CardDescription className="text-sm text-black/60 mt-1">
                  Total de {filteredAndSortedPessoas.length} registro(s)
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
                <Input
                  placeholder="Buscar por nome, documento ou cargo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={filterCargo} onValueChange={setFilterCargo}>
                  <SelectTrigger className="bg-gray-50 border-gray-200">
                    <SelectValue placeholder="Cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Cargos</SelectItem>
                    {cargos.map(cargo => (
                      <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-48">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-gray-50 border-gray-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('nome')} className="-ml-3 h-8 font-medium">
                      Nome
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPessoas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-black/50 py-8">
                      Nenhuma pessoa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedPessoas.map((pessoa) => (
                    <TableRow 
                      key={pessoa.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(pessoa)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 p-1.5 rounded-full">
                            {pessoa.tipo === 'contratado' ? <User size={14} /> : <Briefcase size={14} />}
                          </div>
                          {pessoa.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {pessoa.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{pessoa.cpf_cnpj}</TableCell>
                      <TableCell>{pessoa.cargo}</TableCell>
                      <TableCell>
                        <Badge className={isAtivo(pessoa) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {isAtivo(pessoa) ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{pessoa.celular}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedPessoa && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedPessoa.nome}
                  <Badge variant="secondary" className="ml-2 capitalize">
                    {selectedPessoa.tipo}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Detalhes do cadastro
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Documento</Label>
                    <p className="font-medium">{selectedPessoa.cpf_cnpj}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cargo</Label>
                    <p className="font-medium">{selectedPessoa.cargo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge className={`mt-1 ${isAtivo(selectedPessoa) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {isAtivo(selectedPessoa) ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Admissão</Label>
                    <p className="font-medium">{selectedPessoa.admissao ? new Date(selectedPessoa.admissao).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Contato e Endereço</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-16">Email:</span>
                      <span>{selectedPessoa.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-16">Celular:</span>
                      <span>{selectedPessoa.celular || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-16">Endereço:</span>
                      <span>{selectedPessoa.endereco || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Dados Financeiros</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedPessoa.tipo === 'contratado' && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Salário Fixo</Label>
                        <p className="font-medium">R$ {selectedPessoa.salarioFixo.toLocaleString('pt-BR')}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor por M²</Label>
                      <p className="font-medium">R$ {selectedPessoa.valorm2.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="flex-1">
                    Fechar
                  </Button>
                  <Button className="flex-1 vrz-button-primary">
                    Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}