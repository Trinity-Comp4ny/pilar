import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, DollarSign, Trash2, Settings2, Edit, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

import { useUserRole } from "@/hooks/useUserRole";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG } from "@/constants";

import { type Projeto, type DisciplinaResponsavel, type DisciplinaObservacao, disciplinaStatusOptions, formatCurrency, formatDateShort } from "@/pages/projetos/types";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";
import { ProjectDetailDialog } from "@/pages/projetos/components/ProjectDetailDialog";

const statusConfig = PROJECT_STATUS_CONFIG;

export default function ProjetosKanban() {
  const { data: userRole } = useUserRole();
  const [currentUser, setCurrentUser] = useState<{ name: string, email: string } | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<{ id: string, nome: string }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string, nome: string }[]>([]);
  const [disciplinas, setDisciplinas] = useState<{ id: string, nome: string }[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDisciplinasOpen, setIsDisciplinasOpen] = useState(false);
  const [newDisciplina, setNewDisciplina] = useState("");
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    codigo_projeto: "",
    nome: "",
    cliente_id: "",
    localizacao: "",
    parcelas: "",
    area_m2: "",
    data_inicio: "",
    data_previsao: "",
    data_final: "",
    valor_contrato: "",
    observacao: "",
    status: PROJECT_STATUS.PLANEJAMENTO as Projeto['status'],
  });

  const canEdit = userRole === 'admin' || userRole === 'operacional';

  const [tempDisciplina, setTempDisciplina] = useState<Partial<DisciplinaResponsavel>>({
    disciplina: "",
    responsavel_id: "",
    data_inicio: "",
    data_previsao: "",
    data_final: "",
    status: "Não Iniciado",
    observacoes: []
  });
  
  const [projetosDisciplinas, setProjetosDisciplinas] = useState<DisciplinaResponsavel[]>([]);

  const [selectedDisciplinaIndex, setSelectedDisciplinaIndex] = useState<number | null>(null);
  const [isDisciplinaDetailOpen, setIsDisciplinaDetailOpen] = useState(false);
  const [newObservation, setNewObservation] = useState("");

  const handleOpenDisciplinaDetail = (index: number) => {
    setSelectedDisciplinaIndex(index);
    setIsDisciplinaDetailOpen(true);
  };

  const handleAddObservation = () => {
    if (!newObservation.trim() || selectedDisciplinaIndex === null) return;

    const updatedDisciplinas = [...projetosDisciplinas];
    const discipline = updatedDisciplinas[selectedDisciplinaIndex];
    
    const newObs: DisciplinaObservacao = {
      id: crypto.randomUUID(),
      texto: newObservation,
      usuario: currentUser?.name || "Usuário",
      data: new Date().toISOString()
    };

    updatedDisciplinas[selectedDisciplinaIndex] = {
      ...discipline,
      observacoes: [...(discipline.observacoes || []), newObs]
    };

    setProjetosDisciplinas(updatedDisciplinas);
    setNewObservation("");
  };

  const updateDisciplinaField = (field: keyof DisciplinaResponsavel, value: any) => {
    if (selectedDisciplinaIndex === null) return;
    const updatedDisciplinas = [...projetosDisciplinas];
    updatedDisciplinas[selectedDisciplinaIndex] = {
      ...updatedDisciplinas[selectedDisciplinaIndex],
      [field]: value
    };
    setProjetosDisciplinas(updatedDisciplinas);
  };

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser({
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
        email: user.email || ''
      });
    }
  };

  const fetchData = async () => {
    // Fetch Clientes
    const { data: clientesData } = await supabase.from('clientes').select('id, nome').order('nome');
    if (clientesData) setClientes(clientesData);

    // Fetch Pessoas
    const { data: pessoasData } = await supabase.from('pessoas').select('id, nome').order('nome');
    if (pessoasData) setPessoas(pessoasData);

    // Fetch Disciplinas
    fetchDisciplinas();

    // Fetch Projetos
    fetchProjetos();
  };

  const fetchDisciplinas = async () => {
    const { data } = await supabase.from('disciplinas').select('id, nome').order('nome');
    if (data) setDisciplinas(data);
  };

  const fetchProjetos = async () => {
    const { data, error } = await supabase
      .from('projetos')
      .select(`
        *,
        clientes (nome)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return;
    }

    if (data) {
      const mappedProjetos: Projeto[] = (data ?? []).map((p: any) => ({
        id: p.id,
        codigo_projeto: p.codigo_projeto,
        nome: p.nome,
        cliente_id: p.cliente_id,
        cliente_nome: p.clientes?.nome,
        localizacao: p.localizacao,
        parcelas: p.parcelas,
        area_m2: p.area_m2,
        data_inicio: p.data_inicio,
        data_previsao: p.data_previsao,
        data_final: p.data_final,
        status: p.status as Projeto['status'],
        valor_contrato: p.valor_contrato,
        observacao: p.observacao,
        disciplinas: Array.isArray(p.disciplinas) ? p.disciplinas : []
      }));
      setProjetos(mappedProjetos);
    }
  };

  const handleCardClick = (projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setProjetosDisciplinas(projeto.disciplinas || []);
    setIsDetailOpen(true);
  };

  const handleSaveDisciplinaChanges = async () => {
    if (!selectedProjeto) return;

    try {
      const { error } = await supabase
        .from('projetos')
        .update({ disciplinas: projetosDisciplinas })
        .eq('id', selectedProjeto.id);

      if (error) throw error;

      toast({
        title: "Disciplinas atualizadas",
        description: "As alterações foram salvas com sucesso."
      });

      // Update local state
      const updatedProjeto = { ...selectedProjeto, disciplinas: projetosDisciplinas };
      setSelectedProjeto(updatedProjeto);
      setProjetos(prev => prev.map(p => p.id === updatedProjeto.id ? updatedProjeto : p));
      
      setIsDisciplinaDetailOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEditClick = (projeto: Projeto) => {
    setFormData({
      id: projeto.id,
      codigo_projeto: projeto.codigo_projeto,
      nome: projeto.nome,
      cliente_id: projeto.cliente_id,
      localizacao: projeto.localizacao || "",
      parcelas: projeto.parcelas || "",
      area_m2: projeto.area_m2?.toString() || "",
      data_inicio: projeto.data_inicio || "",
      data_previsao: projeto.data_previsao || "",
      data_final: projeto.data_final || "",
      valor_contrato: projeto.valor_contrato !== undefined ? formatCurrencyInput((projeto.valor_contrato * 100).toString()) : "",
      observacao: projeto.observacao || "",
      status: projeto.status,
    });
    setProjetosDisciplinas(projeto.disciplinas || []);
    setIsEditMode(true);
    setIsDetailOpen(false);
    setIsDialogOpen(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addProjetoDisciplina = () => {
    if (tempDisciplina.disciplina && tempDisciplina.responsavel_id) {
      const pessoa = pessoas.find(p => p.id === tempDisciplina.responsavel_id);
      
      const novaDisciplina: DisciplinaResponsavel = {
        disciplina: tempDisciplina.disciplina,
        responsavel_id: tempDisciplina.responsavel_id,
        responsavel_nome: pessoa?.nome || '',
        data_inicio: tempDisciplina.data_inicio,
        data_previsao: tempDisciplina.data_previsao,
        data_final: tempDisciplina.data_final,
        status: tempDisciplina.status || "Não Iniciado",
        observacoes: tempDisciplina.observacoes || []
      };

      setProjetosDisciplinas([
        ...projetosDisciplinas,
        novaDisciplina
      ]);
      
      // Reset temp
      setTempDisciplina({ 
        disciplina: "", 
        responsavel_id: "", 
        data_inicio: "", 
        data_previsao: "", 
        data_final: "",
        status: "Não Iniciado",
        observacoes: []
      });
    }
  };

  const removeProjetoDisciplina = (index: number) => {
    const newDisciplinas = [...projetosDisciplinas];
    newDisciplinas.splice(index, 1);
    setProjetosDisciplinas(newDisciplinas);
  };

  const updateDisciplinaStatus = (index: number, newStatus: string) => {
    const newDisciplinas = [...projetosDisciplinas];
    newDisciplinas[index].status = newStatus;
    setProjetosDisciplinas(newDisciplinas);
  };

  const handleAddDisciplina = async () => {
    if (!newDisciplina.trim()) return;

    const { error } = await supabase.from('disciplinas').insert({ nome: newDisciplina });

    if (error) {
      toast({ title: "Erro ao adicionar disciplina", variant: "destructive" });
    } else {
      toast({ title: "Disciplina adicionada" });
      setNewDisciplina("");
      fetchDisciplinas();
    }
  };

  const handleDeleteDisciplina = async (id: string) => {
    const { error } = await supabase.from('disciplinas').delete().eq('id', id);
    if (!error) {
      fetchDisciplinas();
    }
  };

  const resetForm = () => {
    setFormData({
      id: "",
      codigo_projeto: "",
      nome: "",
      cliente_id: "",
      localizacao: "",
      parcelas: "",
      area_m2: "",
      data_inicio: "",
      data_previsao: "",
      data_final: "",
      valor_contrato: "",
      observacao: "",
      status: PROJECT_STATUS.PLANEJAMENTO,
    });
    setProjetosDisciplinas([]);
    setIsEditMode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo_projeto || !formData.cliente_id || !formData.nome) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Código, Nome e Cliente",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEditMode && formData.id) {
        // Update existing project
        const { error } = await supabase.rpc('update_projeto_completo', {
          p_projeto_id: formData.id,
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: formData.localizacao,
          p_parcelas: formData.parcelas || null,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: projetosDisciplinas,
          p_status: formData.status
        });

        if (error) throw error;

        toast({
          title: "Projeto atualizado",
          description: "Projeto foi atualizado com sucesso",
        });
      } else {
        // Create new project
        const { data: projetoId, error } = await supabase.rpc('create_projeto_completo', {
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: formData.localizacao,
          p_parcelas: formData.parcelas || null,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: projetosDisciplinas
        });

        if (error) throw error;

        toast({
          title: "Projeto cadastrado",
          description: "Novo projeto foi adicionado com sucesso",
        });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchProjetos();

    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('projetos').delete().eq('id', id);
    if (!error) {
      toast({ title: "Projeto excluído" });
      setIsDetailOpen(false);
      fetchProjetos();
    } else {
      toast({
        title: "Erro ao excluir",
        description: "Verifique se existem registros vinculados.",
        variant: "destructive"
      });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    if (!canEdit) return; // Previne drag se não pode editar

    const newStatus = destination.droppableId as Projeto["status"];
    const todayStr = new Date().toISOString().slice(0, 10);

    // Optimistic update (inclui data_final quando for concluído)
    setProjetos((prevProjetos) =>
      prevProjetos.map((projeto) =>
        projeto.id === draggableId
          ? {
              ...projeto,
              status: newStatus,
              data_final: newStatus === PROJECT_STATUS.CONCLUIDO ? todayStr : projeto.data_final,
            }
          : projeto
      )
    );

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === PROJECT_STATUS.CONCLUIDO) {
        updateData.data_final = todayStr;
      }

      const { error } = await supabase
        .from('projetos')
        .update(updateData)
        .eq('id', draggableId);

      if (error) {
        throw error;
      }

      toast({
        title: "Status atualizado",
        description: `Projeto movido para ${statusConfig[newStatus].label}`,
      });

      // Recarrega para garantir consistência
      fetchProjetos();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
      fetchProjetos(); // Revert
    }
  };

  const getProjetosByStatus = (status: string) => {
    return projetos.filter((projeto) => projeto.status === status);
  };

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Projetos"
          description="Gerencie seus projetos"
          children={
            <div className="flex gap-2">
              {canEdit && (
                <Dialog open={isDisciplinasOpen} onOpenChange={setIsDisciplinasOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-full text-sm">
                      <Settings2 className="mr-2 h-4 w-4" />
                      Disciplinas
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Gerenciar Disciplinas</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nova disciplina..."
                          value={newDisciplina}
                          onChange={(e) => setNewDisciplina(e.target.value)}
                        />
                        <Button onClick={handleAddDisciplina}>Adicionar</Button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {disciplinas.map((d) => (
                          <div key={d.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span>{d.nome}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 h-6 w-6 p-0"
                              onClick={() => handleDeleteDisciplina(d.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {canEdit && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm"
                      onClick={() => {
                        resetForm();
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Projeto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{isEditMode ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
                      <DialogDescription>
                        {isEditMode ? 'Atualize as informações do projeto' : 'Cadastre um novo projeto e defina os responsáveis técnicos'}
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                      {/* Dados Principais */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="codigo_projeto">Código do Projeto *</Label>
                          <Input
                            id="codigo_projeto"
                            value={formData.codigo_projeto}
                            onChange={(e) => handleInputChange("codigo_projeto", e.target.value)}
                            placeholder="PRJ-2024-001"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cliente">Cliente *</Label>
                          <Select
                            value={formData.cliente_id}
                            onValueChange={(value) => handleInputChange("cliente_id", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientes.map((cliente) => (
                                <SelectItem key={cliente.id} value={cliente.id}>
                                  {cliente.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome do Projeto *</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => handleInputChange("nome", e.target.value)}
                          placeholder="Ex: Residência Silva - Reforma Completa"
                          required
                        />
                      </div>

                      {/* Localização e Área */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="md:col-span-2 space-y-2">
                           <Label htmlFor="localizacao">Localização</Label>
                           <Input
                             id="localizacao"
                             value={formData.localizacao}
                             onChange={(e) => handleInputChange("localizacao", e.target.value)}
                             placeholder="Endereço / Local"
                           />
                         </div>
                         <div className="space-y-2">
                            <Label htmlFor="area_m2">Área (m²)</Label>
                            <Input
                              id="area_m2"
                              type="number"
                              step="0.01"
                              value={formData.area_m2}
                              onChange={(e) => handleInputChange("area_m2", e.target.value)}
                              placeholder="0.00"
                            />
                         </div>
                      </div>

                      {/* Financeiro e Prazos */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Financeiro */}
                        <div className="bg-green-50/50 p-4 rounded-lg border border-green-100">
                          <h3 className="text-sm font-medium text-green-800 mb-3 flex items-center gap-2">
                            <DollarSign size={14} /> Financeiro
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="valorTotal" className="text-xs text-green-700">Valor (R$)</Label>
                              <Input
                                id="valorTotal"
                                type="text"
                                value={formData.valor_contrato}
                                onChange={(e) => handleInputChange("valor_contrato", formatCurrencyInput(e.target.value))}
                                placeholder="R$ 0,00"
                                className="border-green-200 focus-visible:ring-green-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="parcelas" className="text-xs text-green-700">Parcelas</Label>
                              <Input
                                id="parcelas"
                                type="number"
                                min="1"
                                value={formData.parcelas}
                                onChange={(e) => handleInputChange("parcelas", e.target.value)}
                                placeholder="1"
                                className="border-green-200 focus-visible:ring-green-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Prazos */}
                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                          <h3 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                            <Calendar size={14} /> Prazos
                          </h3>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="dataInicio" className="text-xs text-blue-700">Início</Label>
                                <Input
                                  id="dataInicio"
                                  type="date"
                                  value={formData.data_inicio}
                                  onChange={(e) => handleInputChange("data_inicio", e.target.value)}
                                  className="h-9 border-blue-200 focus-visible:ring-blue-200"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="dataPrevisao" className="text-xs text-blue-700">Previsão</Label>
                                <Input
                                  id="dataPrevisao"
                                  type="date"
                                  value={formData.data_previsao}
                                  onChange={(e) => handleInputChange("data_previsao", e.target.value)}
                                  className="h-9 border-blue-200 focus-visible:ring-blue-200"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="dataFinal" className="text-xs text-blue-700">Final Real</Label>
                              <Input
                                id="dataFinal"
                                type="date"
                                value={formData.data_final}
                                onChange={(e) => handleInputChange("data_final", e.target.value)}
                                className="h-9 border-blue-200 focus-visible:ring-blue-200"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Disciplinas */}
                      <div className="pt-2">
                        <Label className="text-base font-semibold mb-3 block">Disciplinas e Prazos</Label>
                        
                        <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Disciplina</Label>
                            <Select value={tempDisciplina.disciplina} onValueChange={(val) => setTempDisciplina({ ...tempDisciplina, disciplina: val })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {disciplinas.map(d => (
                                  <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Responsável</Label>
                            <Select value={tempDisciplina.responsavel_id} onValueChange={(val) => setTempDisciplina({ ...tempDisciplina, responsavel_id: val })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {pessoas.map(pessoa => (
                                  <SelectItem key={pessoa.id} value={pessoa.id}>{pessoa.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 md:col-span-2">
                             <div className="space-y-1">
                                <Label className="text-xs">Início</Label>
                                <Input 
                                  type="date" 
                                  value={tempDisciplina.data_inicio} 
                                  onChange={(e) => setTempDisciplina({ ...tempDisciplina, data_inicio: e.target.value })}
                                  className="h-8 text-xs"
                                />
                             </div>
                             <div className="space-y-1">
                                <Label className="text-xs">Previsão</Label>
                                <Input 
                                  type="date" 
                                  value={tempDisciplina.data_previsao} 
                                  onChange={(e) => setTempDisciplina({ ...tempDisciplina, data_previsao: e.target.value })}
                                  className="h-8 text-xs"
                                />
                             </div>
                             <div className="space-y-1">
                                <Label className="text-xs">Final</Label>
                                <Input 
                                  type="date" 
                                  value={tempDisciplina.data_final} 
                                  onChange={(e) => setTempDisciplina({ ...tempDisciplina, data_final: e.target.value })}
                                  className="h-8 text-xs"
                                />
                             </div>
                          </div>

                          <Button type="button" onClick={addProjetoDisciplina} className="md:col-span-2 w-full" variant="secondary">
                            <Plus size={16} className="mr-2" /> Adicionar Disciplina
                          </Button>
                        </div>

                        {projetosDisciplinas.length > 0 && (
                          <div className="space-y-2 mt-4">
                            {projetosDisciplinas.map((pd, idx) => (
                              <div key={idx} className="bg-white border rounded-lg p-3 space-y-2 hover:shadow-sm transition-shadow">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{pd.disciplina}</Badge>
                                    <span className="text-sm font-medium text-gray-700">{pd.responsavel_nome}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenDisciplinaDetail(idx)} className="h-6 w-6 p-0 text-blue-500">
                                      <Edit size={14} />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeProjetoDisciplina(idx)} className="h-6 w-6 p-0 text-red-500">
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
                                  <div>
                                    <span className="font-semibold block">Início</span>
                                    {formatDateShort(pd.data_inicio)}
                                  </div>
                                  <div>
                                    <span className="font-semibold block">Previsão</span>
                                    {formatDateShort(pd.data_previsao)}
                                  </div>
                                  <div>
                                    <span className="font-semibold block">Status</span>
                                    <span className={`${
                                      pd.status === 'Concluído' ? 'text-green-600' : 
                                      pd.status === 'Em Andamento' ? 'text-blue-600' : 'text-gray-600'
                                    }`}>
                                      {pd.status || 'Não Iniciado'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-end gap-1">
                                    <MessageSquare size={12} />
                                    <span>{pd.observacoes?.length || 0}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Modal de Detalhes da Disciplina */}
                      <Dialog open={isDisciplinaDetailOpen} onOpenChange={setIsDisciplinaDetailOpen}>
                        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Detalhes da Disciplina</DialogTitle>
                            <DialogDescription>
                              {selectedDisciplinaIndex !== null && projetosDisciplinas[selectedDisciplinaIndex]?.disciplina} - {selectedDisciplinaIndex !== null && projetosDisciplinas[selectedDisciplinaIndex]?.responsavel_nome}
                            </DialogDescription>
                          </DialogHeader>

                          {selectedDisciplinaIndex !== null && (
                            <div className="space-y-4 mt-2">
                              <div className="space-y-2">
                                <Label>Status</Label>
                                <Select 
                                  value={projetosDisciplinas[selectedDisciplinaIndex].status} 
                                  onValueChange={(val) => updateDisciplinaField('status', val)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {disciplinaStatusOptions.map(opt => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Início</Label>
                                  <Input 
                                    type="date" 
                                    value={projetosDisciplinas[selectedDisciplinaIndex].data_inicio || ''} 
                                    onChange={(e) => updateDisciplinaField('data_inicio', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Previsão</Label>
                                  <Input 
                                    type="date" 
                                    value={projetosDisciplinas[selectedDisciplinaIndex].data_previsao || ''} 
                                    onChange={(e) => updateDisciplinaField('data_previsao', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Final</Label>
                                  <Input 
                                    type="date" 
                                    value={projetosDisciplinas[selectedDisciplinaIndex].data_final || ''} 
                                    onChange={(e) => updateDisciplinaField('data_final', e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="border-t pt-4 space-y-3">
                                <Label className="flex items-center gap-2">
                                  <MessageSquare size={16} /> Observações
                                </Label>
                                
                                <div className="bg-gray-50 rounded-lg p-3 h-48 overflow-y-auto space-y-3">
                                  {projetosDisciplinas[selectedDisciplinaIndex].observacoes?.length === 0 ? (
                                    <p className="text-xs text-center text-gray-400 py-4">Nenhuma observação registrada</p>
                                  ) : (
                                    projetosDisciplinas[selectedDisciplinaIndex].observacoes?.map((obs, i) => (
                                      <div key={i} className="bg-white p-2 rounded border shadow-sm text-sm">
                                        <p className="text-gray-800">{obs.texto}</p>
                                        <div className="flex justify-between items-center mt-1 text-[10px] text-gray-400">
                                          <span>{obs.usuario}</span>
                                          <span>{new Date(obs.data).toLocaleString()}</span>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  <Input 
                                    placeholder="Nova observação..." 
                                    value={newObservation}
                                    onChange={(e) => setNewObservation(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddObservation();
                                      }
                                    }}
                                  />
                                  <Button size="icon" onClick={handleAddObservation}>
                                    <Plus size={16} />
                                  </Button>
                                </div>
                              </div>

                              <Button onClick={() => setIsDisciplinaDetailOpen(false)} className="w-full mt-2" variant="outline">
                                Fechar
                              </Button>
                              
                              {/* Show Save button only if we are NOT in the main edit dialog (meaning we are in the view detail modal) */}
                              {!isDialogOpen && (
                                <Button onClick={handleSaveDisciplinaChanges} className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white">
                                  Salvar Alterações
                                </Button>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="observacao">Observação Geral</Label>
                        <Textarea
                          id="observacao"
                          value={formData.observacao}
                          onChange={(e) => handleInputChange("observacao", e.target.value)}
                          placeholder="Observações gerais do projeto"
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-2 pt-4 md:col-span-2">
                        <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="flex-1">
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white">
                          {isEditMode ? 'Atualizar' : 'Salvar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />
      }
    >
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 min-h-0">
          <div className="grid gap-3 w-full h-full min-h-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex flex-col min-w-[280px] min-h-0">
              <div className={`${config.columnColor} rounded-t-lg p-3 border-b border-black/10`}>
                <h3 className="font-medium text-sm flex items-center justify-between">
                  {config.label}
                  <Badge variant="secondary" className="ml-2">
                    {getProjetosByStatus(status).length}
                  </Badge>
                </h3>
              </div>

              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-b-lg border border-t-0 ${snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-50"
                      }`}
                  >
                    {getProjetosByStatus(status).map((projeto, index) => (
                      <Draggable key={projeto.id} draggableId={projeto.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <ProjectCard
                              projeto={projeto}
                              onClick={handleCardClick}
                              isDragging={snapshot.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
          </div>
        </div>
      </DragDropContext>

      <ProjectDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        projeto={selectedProjeto}
        canEdit={canEdit}
        onEdit={handleEditClick}
        onDelete={handleDelete}
      />
    </PageLayout>
  );
}
