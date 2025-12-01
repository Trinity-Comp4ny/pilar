import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Cliente {
  id: string;
  nome: string;
  cpf: string;
  endereco: string;
  contato: string;
  tipoNF: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([
    {
      id: "1",
      nome: "João Silva",
      cpf: "123.456.789-00",
      endereco: "Rua das Flores, 123 - São Paulo, SP",
      contato: "(11) 99999-9999",
      tipoNF: "CPF",
    },
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [tipoNF, setTipoNF] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Cliente | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !cpf) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos nome e CPF",
        variant: "destructive",
      });
      return;
    }

    const novoCliente: Cliente = {
      id: Date.now().toString(),
      nome,
      cpf,
      endereco,
      contato,
      tipoNF,
    };

    setClientes([...clientes, novoCliente]);
    
    // Reset form
    setNome("");
    setCpf("");
    setEndereco("");
    setContato("");
    setTipoNF("");
    setIsDialogOpen(false);
    
    toast({
      title: "Cliente cadastrado",
      description: "Novo cliente foi adicionado com sucesso",
    });
  };

  const handleSort = (field: keyof Cliente) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedClientes = useMemo(() => {
    let filtered = clientes.filter(cliente => 
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
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
  }, [clientes, searchTerm, sortField, sortDirection]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Clientes</h1>
          <p className="text-sm text-black/60 mt-1">Gerencie seus clientes</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente no sistema
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Endereço completo"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contato">Contato</Label>
                <Input
                  id="contato"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tipoNF">Tipo NF</Label>
                <Select value={tipoNF} onValueChange={setTipoNF}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">PF</SelectItem>
                    <SelectItem value="Engenharia">Engenharia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 pilar-button-primary">
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
              <CardTitle className="text-lg font-medium tracking-tight">Lista de Clientes</CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">
                Total de {filteredAndSortedClientes.length} de {clientes.length} cliente(s)
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <Input
                placeholder="Buscar por nome ou CPF..."
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
                  <TableHead className="hidden md:table-cell">Endereço</TableHead>
                  <TableHead className="hidden lg:table-cell">Contato</TableHead>
                  <TableHead>Tipo NF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-black/50 py-8">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedClientes.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell>{cliente.cpf}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-black/70">{cliente.endereco}</TableCell>
                      <TableCell className="hidden lg:table-cell">{cliente.contato}</TableCell>
                      <TableCell><span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{cliente.tipoNF}</span></TableCell>
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