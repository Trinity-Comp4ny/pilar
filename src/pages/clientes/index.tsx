import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ArrowUpDown, User, Mail, Phone, MapPin, Trash2, Pencil, Building2, Landmark, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  endereco: string;
  contato: string;
  email: string;
  tipo_nf?: string;
  origem?: string;
}

export default function Clientes() {
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === 'admin';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [email, setEmail] = useState("");
  const [tipoNf, setTipoNf] = useState("");
  const [origem, setOrigem] = useState("");
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");

  const formatTelefone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };
  const [sortField, setSortField] = useState<keyof Cliente | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');
    
    if (data) {
      setClientes(data as any[]);
    }
  };

  const resetForm = () => {
    setNome("");
    setCpfCnpj("");
    setEndereco("");
    setContato("");
    setEmail("");
    setTipoNf("");
    setOrigem("");
    setContasBancarias([]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setCurrentId(null);
    setIsEditMode(false);
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditClick = (cliente: Cliente, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNome(cliente.nome);
    setCpfCnpj(cliente.cpf_cnpj);
    setEndereco(cliente.endereco || "");
    setContato(cliente.contato || "");
    setEmail(cliente.email || "");
    setTipoNf(cliente.tipo_nf || "");
    setOrigem(cliente.origem || "");
    setContasBancarias(Array.isArray((cliente as any).contas_bancarias) ? (cliente as any).contas_bancarias : []);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setCurrentId(cliente.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
    setIsDetailOpen(false);
  };

  const handleAddConta = () => {
    if (!newConta.banco || !newConta.agencia || !newConta.conta) {
      toast({
        title: "Dados incompletos",
        description: "Preencha banco, agência e conta antes de adicionar",
        variant: "destructive",
      });
      return;
    }

    setContasBancarias((prev) => [...prev, newConta]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  };

  const handleRemoveConta = (index: number) => {
    setContasBancarias((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !cpfCnpj) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos nome e CPF/CNPJ",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEditMode && currentId) {
        const { error } = await supabase
          .from('clientes')
          .update({
            nome,
            cpf_cnpj: cpfCnpj,
            endereco,
            contato,
            email,
            tipo_nf: tipoNf,
            origem,
            contas_bancarias: contasBancarias
          })
          .eq('id', currentId);

        if (error) throw error;

        toast({ title: "Cliente atualizado", description: "Dados do cliente atualizados com sucesso" });
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert({
            nome,
            cpf_cnpj: cpfCnpj,
            endereco,
            contato,
            email,
            tipo_nf: tipoNf,
            origem,
            contas_bancarias: contasBancarias,
            empresa_id: (await supabase.rpc('get_user_empresa_id')).data 
          });

        if (error) throw error;

        toast({ title: "Cliente cadastrado", description: "Novo cliente foi adicionado com sucesso" });
      }
      
      resetForm();
      setIsDialogOpen(false);
      fetchClientes();

    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (!error) {
      toast({ title: "Cliente excluído" });
      setIsDetailOpen(false);
      fetchClientes();
    } else {
      toast({ title: "Erro ao excluir", description: "Verifique se existem registros vinculados.", variant: "destructive" });
    }
  };

  const handleSort = (field: keyof Cliente) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsDetailOpen(true);
  };

  const filteredAndSortedClientes = useMemo(() => {
    let filtered = clientes.filter(cliente => 
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.cpf_cnpj && cliente.cpf_cnpj.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')))
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
  }, [clientes, searchTerm, sortField, sortDirection]);

  return (
    <PageLayout
      header={
        <PageHeader 
          title="Clientes" 
          description="Gerencie seus clientes"
          children={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm"
                  onClick={handleOpenDialog}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? "Atualize os dados do cliente" : "Cadastre um novo cliente no sistema"}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                    <Label htmlFor="cpf">CPF/CNPJ *</Label>
                    <Input
                      id="cpf"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contato">Contato</Label>
                    <Input
                      id="contato"
                      value={contato}
                      onChange={(e) => setContato(formatTelefone(e.target.value))}
                      maxLength={15}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipoNf">Tipo NF</Label>
                    <Select value={tipoNf} onValueChange={setTipoNf}>
                      <SelectTrigger id="tipoNf">
                        <SelectValue placeholder="Selecione o tipo de NF" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="servico">Serviço</SelectItem>
                        <SelectItem value="produto">Produto</SelectItem>
                        <SelectItem value="misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="origem">Origem</Label>
                    <Input
                      id="origem"
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value)}
                      placeholder="Ex: Indicação, Google"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div className="space-y-3 md:col-span-2 mt-2">
                    <div className="flex items-center justify-between">
                      <Label>Contas Bancárias (para recebimento)</Label>
                      <span className="text-xs text-black/50">Defina uma ou mais contas padrão para este cliente</span>
                    </div>

                    {/* Formulário para nova conta */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">
                      <div className="space-y-1">
                        <Label className="text-xs">Banco</Label>
                        <Input
                          placeholder="Nome do banco"
                          value={newConta.banco}
                          onChange={(e) => setNewConta({ ...newConta, banco: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Agência</Label>
                        <Input
                          placeholder="0000"
                          value={newConta.agencia}
                          onChange={(e) => setNewConta({ ...newConta, agencia: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Conta</Label>
                        <Input
                          placeholder="000000-0"
                          value={newConta.conta}
                          onChange={(e) => setNewConta({ ...newConta, conta: e.target.value })}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Select
                          value={newConta.tipo}
                          onValueChange={(value) => setNewConta({ ...newConta, tipo: value })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corrente">Corrente</SelectItem>
                            <SelectItem value="poupanca">Poupança</SelectItem>
                            <SelectItem value="pj">PJ</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="icon"
                          className="bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full h-9 w-9"
                          onClick={handleAddConta}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Lista de contas já adicionadas */}
                    {contasBancarias.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-black/60">Contas cadastradas</Label>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {contasBancarias.map((conta, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Building2 className="h-4 w-4 text-black/40 flex-shrink-0" />
                                  <span className="font-medium truncate">{conta.banco}</span>
                                </div>
                                <div className="hidden md:flex items-center gap-2 text-xs text-black/60 flex-shrink-0">
                                  <Landmark className="h-3 w-3" />
                                  <span>Ag. {conta.agencia} / Cc. {conta.conta}</span>
                                </div>
                                <span className="text-xs text-black/50 capitalize flex-shrink-0">
                                  {conta.tipo}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 flex-shrink-0"
                                onClick={() => handleRemoveConta(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
          }
        />
      }
    >
      <Card className="rounded-2xl border border-black/5 bg-white w-full">
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
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('cpf_cnpj')} className="-ml-3 h-8 font-medium">
                      CPF/CNPJ
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Contato</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-black/50 py-8">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedClientes.map((cliente) => (
                    <TableRow 
                      key={cliente.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(cliente)}
                    >
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell>{cliente.cpf_cnpj}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-black/70">{cliente.email}</TableCell>
                      <TableCell className="hidden lg:table-cell">{cliente.contato}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleEditClick(cliente, e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={(e) => handleDelete(cliente.id, e)}>
                              <Trash2 className="h-4 w-4" />
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
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedCliente && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedCliente.nome}
                </DialogTitle>
                <DialogDescription>
                  Detalhes do cliente
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                    <p className="font-medium">{selectedCliente.cpf_cnpj}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <User size={14} /> Contato
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-muted-foreground" />
                      {selectedCliente.email || "Não informado"}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-muted-foreground" />
                      {selectedCliente.contato || "Não informado"}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={14} className="text-muted-foreground" />
                      {selectedCliente.endereco || "Não informado"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="flex-1">
                    Fechar
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="secondary" onClick={() => handleEditClick(selectedCliente)} className="flex-1">
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="destructive" onClick={() => handleDelete(selectedCliente.id)} className="flex-1">
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
    </PageLayout>
  );
}