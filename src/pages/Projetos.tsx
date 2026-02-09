import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, User, DollarSign, Trash2, HardHat, Ruler, Settings2, Edit, CheckCircle2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

import { useUserRole } from "@/hooks/useUserRole";

interface DisciplinaObservacao {
  id: string;
  texto: string;
  usuario: string;
  data: string;
}

interface DisciplinaResponsavel {
  disciplina: string;
  responsavel_id: string;
  responsavel_nome: string;
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
  status?: string;
  observacoes?: DisciplinaObservacao[];
}

interface Projeto {
  id: string;
  codigo_projeto: string;
  nome: string;
  cliente_id: string;
  cliente_nome?: string;
  data_inicio: string;
  data_previsao: string;
  data_final?: string;
  localizacao?: string;
  parcelas?: string;
  area_m2?: number;
  status: "Planejamento" | "Em andamento" | "Paralisado" | "Concluído" | "Cancelado";
  valor_contrato: number;
  observacao: string;
  disciplinas: DisciplinaResponsavel[];
}

const statusConfig: Record<string, { label: string, color: string, columnColor: string }> = {
  "Planejamento": { label: "Planejamento", color: "bg-yellow-100 text-yellow-800", columnColor: "bg-yellow-50" },
  "Em andamento": { label: "Em andamento", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
  "Concluído": { label: "Concluído", color: "bg-green-100 text-green-800", columnColor: "bg-green-50" },
  "Paralisado": { label: "Paralisado", color: "bg-accent-orange/10 text-accent-orange", columnColor: "bg-accent-orange/5" },
  "Cancelado": { label: "Cancelado", color: "bg-red-100 text-red-800", columnColor: "bg-red-50" },
};

const disciplinaStatusOptions = [
  "Não Iniciado",
  "Em Andamento",
  "Concluído",
  "Pendente"
];

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
    status: "Planejamento" as Projeto['status'],
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
    const { data: clientesData } = await (supabase.from('clientes') as any).select('id, nome').order('nome');
    if (clientesData) setClientes(clientesData);

    // Fetch Pessoas
    const { data: pessoasData } = await (supabase.from('pessoas') as any).select('id, nome').order('nome');
    if (pessoasData) setPessoas(pessoasData);

    // Fetch Disciplinas
    fetchDisciplinas();

    // Fetch Projetos
    fetchProjetos();
  };

  const fetchDisciplinas = async () => {
    const { data } = await (supabase.from('disciplinas') as any).select('id, nome').order('nome');
    if (data) setDisciplinas(data);
  };

  const fetchProjetos = async () => {
    const { data, error } = await (supabase
      .from('projetos') as any)
      .select(`
        *,
        clientes (nome)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar projetos:', error);
      return;
    }

    if (data) {
      const mappedProjetos: Projeto[] = (data as any[]).map((p: any) => ({
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
      console.error("Erro ao salvar disciplinas:", error);
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
      valor_contrato: projeto.valor_contrato?.toString() || "",
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

    const { error } = await (supabase.from('disciplinas') as any).insert({ nome: newDisciplina });

    if (error) {
      toast({ title: "Erro ao adicionar disciplina", variant: "destructive" });
    } else {
      toast({ title: "Disciplina adicionada" });
      setNewDisciplina("");
      fetchDisciplinas();
    }
  };

  const handleDeleteDisciplina = async (id: string) => {
    const { error } = await (supabase.from('disciplinas') as any).delete().eq('id', id);
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
      status: "Planejamento",
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
        const { error } = await (supabase.rpc as any)('update_projeto_completo', {
          p_projeto_id: formData.id,
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseFloat(formData.valor_contrato) || 0,
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
        const { data: projetoId, error } = await (supabase.rpc as any)('create_projeto_completo', {
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseFloat(formData.valor_contrato) || 0,
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
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('projetos') as any).delete().eq('id', id);
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

    console.log('Tentando atualizar status para:', newStatus);

    // Optimistic update (inclui data_final quando for concluído)
    setProjetos((prevProjetos) =>
      prevProjetos.map((projeto) =>
        projeto.id === draggableId
          ? {
              ...projeto,
              status: newStatus,
              data_final: newStatus === "Concluído" ? todayStr : projeto.data_final,
            }
          : projeto
      )
    );

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "Concluído") {
        updateData.data_final = todayStr;
      }

      const { error } = await (supabase
        .from('projetos') as any)
        .update(updateData)
        .eq('id', draggableId);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        throw error;
      }

      toast({
        title: "Status atualizado",
        description: `Projeto movido para ${statusConfig[newStatus].label}`,
      });

      // Recarrega para garantir consistência
      fetchProjetos();
    } catch (error: any) {
      console.error('Erro completo:', error);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formata data corrigindo o problema de timezone
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const formatDateShort = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Calcula o status de prazo do projeto e status_data
  const getDeadlineStatus = (projeto: { data_previsao?: string, data_final?: string, status: string }) => {
    const { data_previsao, data_final, status } = projeto;

    // Se projeto está concluído, verifica se foi no prazo ou com atraso
    if (status === 'Concluído' && data_final && data_previsao) {
      const final = new Date(data_final + 'T00:00:00');
      const previsao = new Date(data_previsao + 'T00:00:00');

      if (final <= previsao) {
        return { label: 'Concluído no Prazo', color: 'bg-green-600 text-white', days: 0, status_data: 'concluido_no_prazo' };
      } else {
        return { label: 'Concluído com Atraso', color: 'bg-orange-600 text-white', days: 0, status_data: 'concluido_com_atraso' };
      }
    }

    if (!data_previsao || status === 'Cancelado') {
      return null;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const previsao = new Date(data_previsao + 'T00:00:00');
    previsao.setHours(0, 0, 0, 0);

    const diffTime = previsao.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Em Atraso', color: 'bg-red-500 text-white', days: Math.abs(diffDays), status_data: 'em_atraso' };
    } else if (diffDays <= 7) {
      return { label: 'Atenção', color: 'bg-yellow-500 text-white', days: diffDays, status_data: 'atencao' };
    } else {
      return { label: 'No Prazo', color: 'bg-green-500 text-white', days: diffDays, status_data: 'no_prazo' };
    }
  };

  const getProjectProgress = (disciplinas: DisciplinaResponsavel[]) => {
    if (!disciplinas || disciplinas.length === 0) return 0;
    const completed = disciplinas.filter(d => d.status === 'Concluído').length;
    return Math.round((completed / disciplinas.length) * 100);
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
                                type="number"
                                step="0.01"
                                value={formData.valor_contrato}
                                onChange={(e) => handleInputChange("valor_contrato", e.target.value)}
                                placeholder="0.00"
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
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => handleCardClick(projeto)}
                            className={`cursor-pointer hover:shadow-md transition-shadow w-full ${snapshot.isDragging ? "shadow-lg rotate-2" : ""
                              }`}
                          >
                            <CardHeader className="p-2.5 pb-1.5">
                              {(() => {
                                const deadlineStatus = getDeadlineStatus(projeto);
                                return deadlineStatus ? (
                                  <div className="mb-1 flex items-center justify-between">
                                    <Badge className={`text-[9px] px-1.5 py-0 ${deadlineStatus.color}`}>
                                      {deadlineStatus.label}
                                      {deadlineStatus.days > 0 && ` (${deadlineStatus.days}d)`}
                                    </Badge>
                                  </div>
                                ) : null;
                              })()}
                              <div className="flex items-start justify-between gap-1.5 mb-1">
                                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                  {projeto.codigo_projeto}
                                </Badge>
                              </div>
                              <CardTitle className="text-xs font-medium line-clamp-2 leading-tight">
                                {projeto.nome}
                              </CardTitle>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{projeto.cliente_nome}</p>
                            </CardHeader>
                            <CardContent className="p-2.5 pt-0 space-y-1.5">
                               <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-gray-500">
                                     <span>Progresso</span>
                                     <span>{getProjectProgress(projeto.disciplinas)}%</span>
                                  </div>
                                  <Progress value={getProjectProgress(projeto.disciplinas)} className="h-1.5" />
                               </div>

                              {projeto.disciplinas && projeto.disciplinas.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {projeto.disciplinas.slice(0, 2).map((disc, i) => (
                                    <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                      disc.status === 'Concluído' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      <HardHat size={8} /> {disc.disciplina}
                                    </span>
                                  ))}
                                  {projeto.disciplinas.length > 2 && (
                                    <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                      +{projeto.disciplinas.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[10px] pt-1.5 border-t">
                                <div className="flex items-center gap-0.5 font-medium text-green-600">
                                  <DollarSign size={10} className="flex-shrink-0" />

                                  <span className="truncate">{formatCurrency(projeto.valor_contrato)}</span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 text-[10px] text-gray-500">
                                  {projeto.area_m2 !== undefined && (
                                    <div className="flex items-center gap-0.5">
                                      <Ruler size={10} />
                                      <span>{projeto.area_m2 || 0} m²</span>
                                    </div>
                                  )}
                                  {projeto.data_previsao && (
                                    <div className="flex items-center gap-0.5">
                                      <Calendar size={10} />
                                      <span>{formatDateShort(projeto.data_previsao)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
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

      {/* Modal de Detalhes do Projeto */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedProjeto && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl">{selectedProjeto.codigo_projeto}</DialogTitle>
                  <Badge className={statusConfig[selectedProjeto.status]?.color}>
                    {statusConfig[selectedProjeto.status]?.label}
                  </Badge>
                </div>
                <DialogDescription>
                  {selectedProjeto.nome}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cliente</Label>
                    <div className="font-medium flex items-center gap-2">
                      <User size={14} /> {selectedProjeto.cliente_nome}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor Contrato</Label>
                    <div className="font-medium flex items-center gap-2">
                      <DollarSign size={14} /> {formatCurrency(selectedProjeto.valor_contrato)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Área (m²)</Label>
                    <div className="font-medium flex items-center gap-2">
                      <Ruler size={14} /> {selectedProjeto.area_m2 || 0} m²
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Início</Label>
                    <div className="font-medium flex items-center gap-2">
                      <Calendar size={14} /> {formatDate(selectedProjeto.data_inicio)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Previsão Entrega</Label>
                    <div className="font-medium flex items-center gap-2">
                      <Calendar size={14} /> {formatDate(selectedProjeto.data_previsao)}
                      {(() => {
                        const deadlineStatus = getDeadlineStatus(selectedProjeto);
                        return deadlineStatus ? (
                          <Badge className={`text-xs ml-2 ${deadlineStatus.color}`}>
                            {deadlineStatus.label} {deadlineStatus.days > 0 && `(${deadlineStatus.days}d)`}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Final</Label>
                    <div className="font-medium flex items-center gap-2">
                      <Calendar size={14} /> {formatDate(selectedProjeto.data_final)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">Progresso</Label>
                    <div className="flex items-center gap-2">
                       <Progress value={getProjectProgress(selectedProjeto.disciplinas)} className="h-2 flex-1" />
                       <span className="text-sm font-medium">{getProjectProgress(selectedProjeto.disciplinas)}%</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Localização</Label>
                    <div className="font-medium flex items-center gap-2">
                      {selectedProjeto.localizacao || '-'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Parcelas</Label>
                    <div className="font-medium flex items-center gap-2">
                      {selectedProjeto.parcelas || '-'}
                    </div>
                  </div>
                </div>

                {selectedProjeto.disciplinas && selectedProjeto.disciplinas.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-3 block">Disciplinas, Prazos e Status</Label>
                    <div className="space-y-3">
                      {selectedProjeto.disciplinas.map((disc, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-sm block">{disc.disciplina}</span>
                              <span className="text-xs text-muted-foreground">{disc.responsavel_nome}</span>
                            </div>
                            <Badge variant="outline" className={`${
                              disc.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200' : 
                              disc.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                              'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {disc.status || 'Não Iniciado'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                            <div>
                              <span className="block text-[10px] uppercase text-gray-400">Início</span>
                              {formatDateShort(disc.data_inicio) || '-'}
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase text-gray-400">Previsão</span>
                              {formatDateShort(disc.data_previsao) || '-'}
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase text-gray-400">Final</span>
                              {formatDateShort(disc.data_final) || '-'}
                            </div>
                          </div>

                          {disc.observacoes && disc.observacoes.length > 0 && (
                            <div className="border-t border-gray-100 pt-2 mt-2">
                              <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                                <MessageSquare size={10} /> Última observação
                              </p>
                              <p className="text-xs text-gray-700 line-clamp-2 italic">
                                "{disc.observacoes[disc.observacoes.length - 1].texto}"
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProjeto.observacao && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <p className="text-sm bg-gray-50 p-3 rounded mt-1 text-gray-700">
                      {selectedProjeto.observacao}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="flex-1">
                    Fechar
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        variant="default"
                        onClick={() => handleEditClick(selectedProjeto)}
                        className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="destructive" onClick={() => handleDelete(selectedProjeto.id)}>
                        <Trash2 className="h-4 w-4" />
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
