import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, User, DollarSign, Trash2, HardHat, Ruler, Settings2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

import { useUserRole } from "@/hooks/useUserRole";

interface DisciplinaResponsavel {
  disciplina: string;
  responsavel_id: string;
  responsavel_nome: string;
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

export default function ProjetosKanban() {
  const { data: userRole } = useUserRole();
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

  const [tempDisciplina, setTempDisciplina] = useState({ disciplina: "", responsavel_id: "" });
  const [projetosDisciplinas, setProjetosDisciplinas] = useState<DisciplinaResponsavel[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

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
    setIsDetailOpen(true);
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
      setProjetosDisciplinas([
        ...projetosDisciplinas,
        {
          disciplina: tempDisciplina.disciplina,
          responsavel_id: tempDisciplina.responsavel_id,
          responsavel_nome: pessoa?.nome || ''
        }
      ]);
      setTempDisciplina({ disciplina: "", responsavel_id: "" });
    }
  };

  const removeProjetoDisciplina = (index: number) => {
    const newDisciplinas = [...projetosDisciplinas];
    newDisciplinas.splice(index, 1);
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

  return (
    <PageLayout
      header={
        <PageHeader
          title="Projetos"
          description="Gerencie seus projetos em formato Kanban"
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
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{isEditMode ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
                      <DialogDescription>
                        {isEditMode ? 'Atualize as informações do projeto' : 'Cadastre um novo projeto e defina os responsáveis técnicos'}
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="nome">Nome do Projeto *</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => handleInputChange("nome", e.target.value)}
                          placeholder="Ex: Residência Silva - Reforma Completa"
                          required
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="localizacao">Localização</Label>
                        <Input
                          id="localizacao"
                          value={formData.localizacao}
                          onChange={(e) => handleInputChange("localizacao", e.target.value)}
                          placeholder="Ex: Rua das Flores, 123 - Centro"
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

                      <div className="space-y-2">
                        <Label htmlFor="valorTotal">Valor do Contrato (R$)</Label>
                        <Input
                          id="valorTotal"
                          type="number"
                          step="0.01"
                          value={formData.valor_contrato}
                          onChange={(e) => handleInputChange("valor_contrato", e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dataInicio">Data Início</Label>
                          <Input
                            id="dataInicio"
                            type="date"
                            value={formData.data_inicio}
                            onChange={(e) => handleInputChange("data_inicio", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dataPrevisao">Previsão de Término</Label>
                          <Input
                            id="dataPrevisao"
                            type="date"
                            value={formData.data_previsao}
                            onChange={(e) => handleInputChange("data_previsao", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dataFinal">Data Final</Label>
                          <Input
                            id="dataFinal"
                            type="date"
                            value={formData.data_final}
                            onChange={(e) => handleInputChange("data_final", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="parcelas">Parcelas</Label>
                        <Input
                          id="parcelas"
                          type="number"
                          min="1"
                          value={formData.parcelas}
                          onChange={(e) => handleInputChange("parcelas", e.target.value)}
                          placeholder="1"
                        />
                      </div>

                      {/* Seção de Disciplinas e Responsáveis */}
                      <div className="space-y-2 md:col-span-2 border-t pt-4">
                        <Label>Disciplinas e Responsáveis</Label>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
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
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Responsável</Label>
                            <Select value={tempDisciplina.responsavel_id} onValueChange={(val) => setTempDisciplina({ ...tempDisciplina, responsavel_id: val })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a pessoa" />
                              </SelectTrigger>
                              <SelectContent>
                                {pessoas.map(pessoa => (
                                  <SelectItem key={pessoa.id} value={pessoa.id}>{pessoa.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="button" onClick={addProjetoDisciplina} variant="secondary">
                            <Plus size={16} />
                          </Button>
                        </div>

                        {projetosDisciplinas.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {projetosDisciplinas.map((pd, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                                <span className="font-medium">{pd.disciplina}: <span className="font-normal text-gray-600">{pd.responsavel_nome}</span></span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeProjetoDisciplina(idx)} className="h-6 w-6 p-0 text-red-500">
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="observacao">Observação</Label>
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
        <div className="grid gap-3 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex flex-col min-w-[280px]">
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
                    className={`flex-1 p-2 space-y-2 min-h-[200px] rounded-b-lg border border-t-0 ${snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-50"
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
                              {projeto.disciplinas && projeto.disciplinas.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {projeto.disciplinas.slice(0, 1).map((disc, i) => (
                                    <span key={i} className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 flex items-center gap-0.5">
                                      <HardHat size={8} /> {disc.disciplina}
                                    </span>
                                  ))}
                                  {projeto.disciplinas.length > 1 && (
                                    <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                      +{projeto.disciplinas.length - 1}
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
                    <Label className="text-xs text-muted-foreground mb-2 block">Disciplinas e Responsáveis</Label>
                    <div className="space-y-2">
                      {selectedProjeto.disciplinas.map((disc, idx) => (
                        <div key={idx} className="flex justify-between text-sm border-b pb-1 last:border-0">
                          <span className="text-gray-600">{disc.disciplina}</span>
                          <span className="font-medium">{disc.responsavel_nome}</span>
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
