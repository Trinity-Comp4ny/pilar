import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ArrowUpDown, User, Briefcase, Trash2, Pencil, Loader2, Landmark, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { formatCPF, formatPhone } from "@/lib/maskUtils";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CONTRACT_TYPES, CONTRACT_TYPE_LABELS } from "@/constants";

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
  data_demissao?: string;
  contas_bancarias?: any[];
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
    tipo_contrato: CONTRACT_TYPES.CONTRATADO,
    cargo: "",
    telefone: "",
    email: "",
    endereco: "",
    data_admissao: "",
    data_demissao: "",
    salario_fixo: "",
    valor_m2: "",
    contas_bancarias: "",
  });
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });
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
    const { data, error } = await supabase
      .from('pessoas')
      .select('*')
      .order('nome');

    if (data) {
      setPessoas(data as unknown as Pessoa[]);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      id: "",
      nome: "",
      cpf: "",
      tipo_contrato: CONTRACT_TYPES.CONTRATADO,
      cargo: "",
      telefone: "",
      email: "",
      endereco: "",
      data_admissao: "",
      data_demissao: "",
      salario_fixo: "",
      valor_m2: "",
      contas_bancarias: ""
    });
    setContasBancarias([]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
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
      data_demissao: pessoa.data_demissao || "",
      salario_fixo: pessoa.salario_fixo !== undefined && pessoa.salario_fixo !== null ? formatCurrencyInput((pessoa.salario_fixo * 100).toString()) : "",
      valor_m2: pessoa.valor_m2 !== undefined && pessoa.valor_m2 !== null ? formatCurrencyInput((pessoa.valor_m2 * 100).toString()) : "",
      contas_bancarias: pessoa.contas_bancarias || "",
    });
    setContasBancarias(Array.isArray(pessoa.contas_bancarias) ? pessoa.contas_bancarias : []);
    setIsEditMode(true);
    setIsDialogOpen(true);
    setIsDetailOpen(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

    const isFirst = contasBancarias.length === 0;
    setContasBancarias((prev) => [
      ...prev, 
      { ...newConta, is_primary: isFirst }
    ]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  };

  const handleSetPrimaryConta = (index: number) => {
    setContasBancarias(prev => prev.map((conta, i) => ({
      ...conta,
      is_primary: i === index
    })));
  };

  const handleRemoveConta = (index: number) => {
    setContasBancarias((prev) => {
      const newContas = prev.filter((_, i) => i !== index);
      if (prev[index].is_primary && newContas.length > 0) {
        newContas[0].is_primary = true;
      }
      return newContas;
    });
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
        data_demissao: formData.data_demissao || null,
        contas_bancarias: contasBancarias,
        salario_fixo: formData.salario_fixo ? parseCurrencyString(formData.salario_fixo) : null,
        valor_m2: formData.valor_m2 ? parseCurrencyString(formData.valor_m2) : null,
      };

      if (isEditMode && formData.id) {
        const { error } = await supabase.from('pessoas')
          .update(payload)
          .eq('id', formData.id);

        if (error) throw error;

        toast({
          title: "Pessoa atualizada",
          description: "Dados da pessoa atualizados com sucesso",
        });
      } else {
        const { error } = await supabase.from('pessoas').insert({
          ...payload,
          empresa_id: (await supabase.rpc('get_user_empresa_id', {})).data
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
        description: "Verifique os dados e tente novamente. Certifique-se de que não existem dados duplicados.",
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
    
    const { error } = await supabase.from('pessoas').delete().eq('id', pessoaToDelete);
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

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const fuzzyMatch = (text: string, query: string) => {
    const q = normalize(query);
    if (!q) return true;
    const t = normalize(text);
    let ti = 0;
    for (const qc of q) {
      ti = t.indexOf(qc, ti);
      if (ti === -1) return false;
      ti++;
    }
    return true;
  };

  const cargos = useMemo(() => {
    const uniqueCargos = Array.from(new Set(pessoas.map(p => p.cargo)));
    return uniqueCargos;
  }, [pessoas]);

  const filteredAndSortedPessoas = useMemo(() => {
    const term = searchTerm.trim();
    const filtered = pessoas.filter((pessoa) => {
      if (!term) return filterCargo === "todos" || pessoa.cargo === filterCargo;

      const digits = pessoa.cpf ? pessoa.cpf.replace(/\D/g, "") : "";
      const termDigits = term.replace(/\D/g, "");

      const matchesText =
        fuzzyMatch(pessoa.nome, term) ||
        fuzzyMatch(pessoa.cargo, term) ||
        (termDigits && digits.includes(termDigits));

      const matchesCargo = filterCargo === "todos" || pessoa.cargo === filterCargo;
      return matchesText && matchesCargo;
    });

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
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
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
                <Button className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm">
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
                        <SelectItem value={CONTRACT_TYPES.CONTRATADO}>{CONTRACT_TYPE_LABELS[CONTRACT_TYPES.CONTRATADO]}</SelectItem>
                        <SelectItem value={CONTRACT_TYPES.TERCEIRIZADO}>{CONTRACT_TYPE_LABELS[CONTRACT_TYPES.TERCEIRIZADO]}</SelectItem>
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
                      onChange={(e) => handleInputChange("cpf", formatCPF(e.target.value))}
                      maxLength={14}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cargo">Cargo/Função *</Label>
                    <Input
                      id="cargo"
                      value={formData.cargo}
                      onChange={(e) => handleInputChange("cargo", e.target.value)}
                      placeholder="Ex: Arquiteto, Pedreiro"
                      required
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

                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone/Celular</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => handleInputChange("telefone", formatPhone(e.target.value))}
                        maxLength={15}
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
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
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
                      <Label htmlFor="data_demissao">Data de Demissão</Label>
                      <Input
                        id="data_demissao"
                        type="date"
                        value={formData.data_demissao}
                        onChange={(e) => handleInputChange("data_demissao", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="salario_fixo">Salário Fixo (R$)</Label>
                      <Input
                        id="salario_fixo"
                        type="text"
                        value={formData.salario_fixo}
                        onChange={(e) => handleInputChange("salario_fixo", formatCurrencyInput(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valor_m2">Valor m² (R$)</Label>
                      <Input
                        id="valor_m2"
                        type="text"
                        value={formData.valor_m2}
                        onChange={(e) => handleInputChange("valor_m2", formatCurrencyInput(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 md:col-span-2 mt-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>Contas Bancárias</Label>
                      <span className="text-xs text-black/50">Cadastre uma ou mais contas para pagamento</span>
                    </div>

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

                    {contasBancarias.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-black/60">Contas cadastradas</Label>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {contasBancarias.map((conta, index) => (
                            <div
                              key={index}
                              className={`flex items-center justify-between gap-3 bg-gray-50 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? 'border-accent-orange/50 bg-accent-orange/5' : 'border-gray-200'}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={() => handleSetPrimaryConta(index)}
                                  title="Definir como principal"
                                >
                                  <Landmark className={`h-4 w-4 ${conta.is_primary ? 'text-accent-orange fill-accent-orange' : 'text-gray-400'}`} />
                                </Button>
                                <span className="font-medium truncate">{conta.banco}</span>
                                <span className="hidden md:inline text-xs text-black/60 flex-shrink-0">
                                  Ag. {conta.agencia} / Cc. {conta.conta}
                                </span>
                                <span className="text-xs text-black/50 capitalize flex-shrink-0">
                                  {conta.tipo}
                                </span>
                                {conta.is_primary && (
                                  <span className="text-[10px] bg-accent-orange/10 text-accent-orange px-1.5 py-0.5 rounded">Principal</span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 flex-shrink-0"
                                onClick={() => handleRemoveConta(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 pt-4 md:col-span-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white">
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
      <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col min-h-0">
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
        <CardContent className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto w-full max-h-[calc(100svh-260px)]">
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
                  {selectedPessoa.data_demissao && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Demissão</Label>
                      <p className="font-medium">{selectedPessoa.data_demissao}</p>
                    </div>
                  )}
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

                {/* Seção de Contas Bancárias no Detalhe */}
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Contas Bancárias</h4>
                  {(selectedPessoa.contas_bancarias && selectedPessoa.contas_bancarias.length > 0) ? (
                    <div className="space-y-2">
                      {selectedPessoa.contas_bancarias.map((conta: any, index: number) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between gap-3 bg-gray-50 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? 'border-accent-orange/50 bg-accent-orange/5' : 'border-gray-200'}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-1.5 rounded-full bg-white border border-gray-100 text-gray-500">
                              <Landmark size={14} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{conta.banco}</span>
                                {conta.is_primary && (
                                  <span className="text-[10px] bg-accent-orange/10 text-accent-orange px-1.5 py-0.5 rounded font-medium">Principal</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-black/60">
                                <span>Ag: {conta.agencia}</span>
                                <span className="text-gray-300">|</span>
                                <span>Cc: {conta.conta}</span>
                                <span className="text-gray-300">|</span>
                                <span className="capitalize">{conta.tipo}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhuma conta bancária cadastrada.</p>
                  )}
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
