import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, User, DollarSign, Trash2, HardHat, Ruler, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

import { useUserRole } from "@/hooks/useUserRole";

interface ProjetoResponsavel {
  id?: string;
  pessoa_id: string;
  pessoa_nome?: string;
  responsabilidade: string;
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
  projetos_responsaveis: ProjetoResponsavel[];
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

  const [formData, setFormData] = useState({
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
  });

  const canEdit = userRole === 'admin' || userRole === 'operacional';

  const [tempTecnico, setTempTecnico] = useState({ responsabilidade: "", pessoa_id: "" });
  const [projetosTecnicos, setProjetosTecnicos] = useState<ProjetoResponsavel[]>([]);

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
        clientes (nome),
        projetos_responsaveis (
          id,
          pessoa_id,
          responsabilidade,
          pessoas (nome)
        )
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
        projetos_responsaveis: p.projetos_responsaveis?.map((pr: any) => ({
          id: pr.id,
          pessoa_id: pr.pessoa_id,
          responsabilidade: pr.responsabilidade,
          pessoa_nome: pr.pessoas?.nome
        })) || []
      }));
      setProjetos(mappedProjetos);
    }
  };

  const handleCardClick = (projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setIsDetailOpen(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addProjetoTecnico = () => {
    if (tempTecnico.responsabilidade && tempTecnico.pessoa_id) {
      const pessoa = pessoas.find(p => p.id === tempTecnico.pessoa_id);
      setProjetosTecnicos([
        ...projetosTecnicos,
        {
          ...tempTecnico,
          pessoa_nome: pessoa?.nome
        }
      ]);
      setTempTecnico({ responsabilidade: "", pessoa_id: "" });
    }
  };

  const removeProjetoTecnico = (index: number) => {
    const newTecnicos = [...projetosTecnicos];
    newTecnicos.splice(index, 1);
    setProjetosTecnicos(newTecnicos);
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
      // Use RPC to save Project + Responsibles in a transaction
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
        p_parcelas: formData.parcelas,
        p_area_m2: parseFloat(formData.area_m2) || 0,
        p_responsaveis: projetosTecnicos.map(pt => ({
          pessoa_id: pt.pessoa_id,
          disciplina: pt.responsabilidade
        }))
      });

      if (error) throw error;

      toast({
        title: "Projeto cadastrado",
        description: "Novo projeto foi adicionado com sucesso",
      });

      // Reset form
      setFormData({
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
      });
      setProjetosTecnicos([]);
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

    const newStatus = destination.droppableId as Projeto["status"];

    // Optimistic update
    setProjetos((prevProjetos) =>
      prevProjetos.map((projeto) =>
        projeto.id === draggableId ? { ...projeto, status: newStatus } : projeto
      )
    );

    try {
      const { error } = await (supabase
        .from('projetos') as any)
        .update({ status: newStatus })
        .eq('id', draggableId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Projeto movido para ${statusConfig[newStatus].label}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
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
                    <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Projeto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Novo Projeto</DialogTitle>
                      <DialogDescription>
                        Cadastre um novo projeto e defina os responsáveis técnicos
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

                      {/* Seção de Projetos Técnicos */}
                      <div className="space-y-2 md:col-span-2 border-t pt-4">
                        <Label>Responsáveis Técnicos</Label>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Disciplina/Função</Label>
                            <Select value={tempTecnico.responsabilidade} onValueChange={(val) => setTempTecnico({ ...tempTecnico, responsabilidade: val })}>
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
                            <Select value={tempTecnico.pessoa_id} onValueChange={(val) => setTempTecnico({ ...tempTecnico, pessoa_id: val })}>
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
                          <Button type="button" onClick={addProjetoTecnico} variant="secondary">
                            <Plus size={16} />
                          </Button>
                        </div>

                        {projetosTecnicos.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {projetosTecnicos.map((pt, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                                <span className="font-medium">{pt.responsabilidade}: <span className="font-normal text-gray-600">{pt.pessoa_nome}</span></span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeProjetoTecnico(idx)} className="h-6 w-6 p-0 text-red-500">
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
              )}
            </div>
          }
        />
      }
    >
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex flex-col h-full">
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
                            <CardHeader className="p-3 pb-2">
                              <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                                <Badge variant="outline" className="text-xs font-mono">
                                  {projeto.codigo_projeto}
                                </Badge>
                              </div>
                              <CardTitle className="text-sm font-medium line-clamp-2">
                                {projeto.nome}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground line-clamp-1">{projeto.cliente_nome}</p>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-2">
                              {projeto.projetos_responsaveis && projeto.projetos_responsaveis.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {projeto.projetos_responsaveis.slice(0, 2).map((pt, i) => (
                                    <span key={i} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 flex items-center gap-1">
                                      <HardHat size={8} /> {pt.responsabilidade}
                                    </span>
                                  ))}
                                  {projeto.projetos_responsaveis.length > 2 && (
                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                      +{projeto.projetos_responsaveis.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between text-xs font-medium text-green-600 pt-2 border-t">
                                <div className="flex items-center gap-1">
                                  <DollarSign size={12} className="flex-shrink-0" />
                                  <span>{formatCurrency(projeto.valor_contrato)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500 font-normal">
                                  <Calendar size={12} />
                                  <span>{projeto.data_previsao ? new Date(projeto.data_previsao).toLocaleDateString('pt-BR') : '-'}</span>
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
                      <Calendar size={14} /> {selectedProjeto.data_inicio ? new Date(selectedProjeto.data_inicio).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Previsão Entrega</Label>
                    <div className="font-medium flex items-center gap-2">
                      <Calendar size={14} /> {selectedProjeto.data_previsao ? new Date(selectedProjeto.data_previsao).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Final</Label>
                    <div className="font-medium flex items-center gap-2">
                      <Calendar size={14} /> {selectedProjeto.data_final ? new Date(selectedProjeto.data_final).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Localização</Label>
                    <div className="font-medium flex items-center gap-2">
                      {selectedProjeto.localizacao || '-'}
                    </div>
                  </div>
                </div>

                {selectedProjeto.projetos_responsaveis && selectedProjeto.projetos_responsaveis.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Responsáveis Técnicos</Label>
                    <div className="space-y-2">
                      {selectedProjeto.projetos_responsaveis.map((pt, idx) => (
                        <div key={idx} className="flex justify-between text-sm border-b pb-1 last:border-0">
                          <span className="text-gray-600">{pt.responsabilidade}</span>
                          <span className="font-medium">{pt.pessoa_nome}</span>
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
                    <Button variant="destructive" onClick={() => handleDelete(selectedProjeto.id)} className="flex-1">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
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
