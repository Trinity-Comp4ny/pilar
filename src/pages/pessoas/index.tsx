import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ArrowUpDown, User, Briefcase, Trash2, Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Pessoa {
  id: string;
  nome: string;
  cpf: string;
  tipo_contrato: string;
  cargo: string;
  telefone: string;
  email: string;
  endereco?: string;
  data_admissao?: string;
  salario_fixo?: number;
  valor_m2?: number;
}

export default function Pessoas() {
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === 'admin';
  
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pessoaToDelete, setPessoaToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    id: "",
    nome: "",
    cpf: "",
    tipo_contrato: "contratado",
    cargo: "",
    telefone: "",
    email: "",
    endereco: "",
    data_admissao: "",
    salario_fixo: "",
    valor_m2: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCargo, setFilterCargo] = useState("todos");
  const [sortField, setSortField] = useState<keyof Pessoa | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  useEffect(() => {
    fetchPessoas();
  }, []);

  const fetchPessoas = async () => {
    setIsLoading(true);
    const { data, error } = await (supabase
      .from('pessoas') as any)
      .select('*')
      .order('nome');
    
    if (data) {
      setPessoas(data as any[]);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      id: "",
      nome: "",
      cpf: "",
      tipo_contrato: "contratado",
      cargo: "",
      telefone: "",
      email: "",
      endereco: "",
      data_admissao: "",
      salario_fixo: "",
      valor_m2: "",
    });
    setIsEditMode(false);
  };

  const handleEditClick = (pessoa: Pessoa, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFormData({
      id: pessoa.id,
      nome: pessoa.nome,
      cpf: pessoa.cpf || "",
      tipo_contrato: pessoa.tipo_contrato,
      cargo: pessoa.cargo,
      telefone: pessoa.telefone || "",
      email: pessoa.email || "",
      endereco: pessoa.endereco || "",
      data_admissao: pessoa.data_admissao || "",
      salario_fixo: pessoa.salario_fixo?.toString() || "",
      valor_m2: pessoa.valor_m2?.toString() || "",
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
    setIsDetailOpen(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.cargo) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e cargo",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        nome: formData.nome,
        cpf: formData.cpf,
        tipo_contrato: formData.tipo_contrato,
        cargo: formData.cargo,
        telefone: formData.telefone,
        email: formData.email,
        endereco: formData.endereco,
        data_admissao: formData.data_admissao || null,
        salario_fixo: formData.salario_fixo ? parseFloat(formData.salario_fixo) : null,
        valor_m2: formData.valor_m2 ? parseFloat(formData.valor_m2) : null,
      };

      if (isEditMode && formData.id) {
        const { error } = await (supabase.from('pessoas') as any)
          .update(payload)
          .eq('id', formData.id);

        if (error) throw error;

        toast({
          title: "Pessoa atualizada",
          description: "Dados da pessoa atualizados com sucesso",
        });
      } else {
        const { error } = await (supabase.from('pessoas') as any).insert({
          ...payload,
          empresa_id: (await (supabase.rpc as any)('get_user_empresa_id')).data 
        });

        if (error) throw error;

        toast({
          title: "Pessoa cadastrada",
          description: "Nova pessoa foi adicionada com sucesso",
        });
      }
      
      resetForm();
      setIsDialogOpen(false);
      fetchPessoas();

    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setPessoaToDelete(id);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pessoaToDelete) return;
    
    const { error } = await (supabase.from('pessoas') as any).delete().eq('id', pessoaToDelete);
    if (!error) {
      toast({ title: "Pessoa excluída" });
      setIsDetailOpen(false);
      fetchPessoas();
    }
    setConfirmDeleteOpen(false);
    setPessoaToDelete(null);
  };

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
      (pessoa.cpf && pessoa.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))) ||
      pessoa.cargo.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterCargo === "todos" || pessoa.cargo === filterCargo)
    );

    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField] || '';
        const bValue = b[sortField] || '';
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [pessoas, searchTerm, filterCargo, sortField, sortDirection]);

  return (
    <PageLayout
      header={
        <PageHeader 
          title="Pessoas" 
          description="Gerencie funcionários e terceirizados"
          children={
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Pessoa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? 'Atualize os dados da pessoa' : 'Cadastre um novo funcionário ou terceirizado'}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tipo_contrato">Tipo de Contrato *</Label>
                    <Select 
                      value={formData.tipo_contrato} 
                      onValueChange={(value) => handleInputChange("tipo_contrato", value)}
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
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => handleInputChange("cpf", e.target.value)}
                      placeholder="000.000.000-00"
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
                    <Label htmlFor="telefone">Telefone/Celular</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => handleInputChange("telefone", e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => handleInputChange("endereco", e.target.value)}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_admissao">Data de Admissão</Label>
                    <Input
                      id="data_admissao"
                      type="date"
                      value={formData.data_admissao}
                      onChange={(e) => handleInputChange("data_admissao", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salario_fixo">Salário Fixo</Label>
                    <Input
                      id="salario_fixo"
                      type="number"
                      step="0.01"
                      value={formData.salario_fixo}
                      onChange={(e) => handleInputChange("salario_fixo", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valor_m2">Valor m²</Label>
                    <Input
                      id="valor_m2"
                      type="number"
                      step="0.01"
                      value={formData.valor_m2}
                      onChange={(e) => handleInputChange("valor_m2", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-4 md:col-span-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 vrz-button-primary">
                      {isEditMode ? 'Atualizar' : 'Salvar'}
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Lista de Pessoas</CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">
                Total de {filteredAndSortedPessoas.length} de {pessoas.length} pessoa(s)
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
                <Input
                  placeholder="Buscar por nome ou cargo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>
              <div className="w-full sm:w-48">
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
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
                    <TableHead>CPF</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedPessoas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-black/50 py-8">
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
                              {pessoa.tipo_contrato === 'contratado' ? <User size={14} /> : <Briefcase size={14} />}
                            </div>
                            {pessoa.nome}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {pessoa.tipo_contrato}
                          </Badge>
                        </TableCell>
                        <TableCell>{pessoa.cpf || '-'}</TableCell>
                        <TableCell>{pessoa.cargo}</TableCell>
                        <TableCell className="hidden md:table-cell">{pessoa.telefone || '-'}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => handleEditClick(pessoa, e)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(pessoa.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
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
                    {selectedPessoa.tipo_contrato}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Detalhes do cadastro
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">CPF</Label>
                    <p className="font-medium">{selectedPessoa.cpf || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cargo</Label>
                    <p className="font-medium">{selectedPessoa.cargo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Admissão</Label>
                    <p className="font-medium">{selectedPessoa.data_admissao || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Salário Fixo</Label>
                    <p className="font-medium">
                      {selectedPessoa.salario_fixo 
                        ? `R$ ${selectedPessoa.salario_fixo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor m²</Label>
                    <p className="font-medium">
                      {selectedPessoa.valor_m2 
                        ? `R$ ${selectedPessoa.valor_m2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                        : '-'}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Contato & Endereço</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-20">Email:</span>
                      <span>{selectedPessoa.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-20">Telefone:</span>
                      <span>{selectedPessoa.telefone || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-20">Endereço:</span>
                      <span>{selectedPessoa.endereco || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="flex-1">
                    Fechar
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="outline" onClick={() => handleEditClick(selectedPessoa)} className="flex-1">
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="destructive" onClick={() => handleDeleteClick(selectedPessoa.id)} className="flex-1">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Pessoa"
        description="Tem certeza que deseja excluir esta pessoa? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}