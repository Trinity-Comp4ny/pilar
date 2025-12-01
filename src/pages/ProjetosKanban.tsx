import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, User, MapPin, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface Projeto {
  id: string;
  projetoID: string;
  cliente: string;
  localizacao: string;
  dataInicio: string;
  dataPrevisao: string;
  status: "planejamento" | "em-andamento" | "em-revisao" | "concluido" | "pausado" | "cancelado";
  tipo: string;
  pacote: string;
  m2: number;
  valorTotal: number;
  arquiteto: string;
  briefing?: string;
}

const statusConfig = {
  planejamento: { label: "Planejamento", color: "bg-yellow-100 text-yellow-800", columnColor: "bg-yellow-50" },
  "em-andamento": { label: "Em Andamento", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
  "em-revisao": { label: "Em Revisão", color: "bg-purple-100 text-purple-800", columnColor: "bg-purple-50" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800", columnColor: "bg-green-50" },
  pausado: { label: "Pausado", color: "bg-orange-100 text-orange-800", columnColor: "bg-orange-50" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800", columnColor: "bg-red-50" },
};

export default function ProjetosKanban() {
  const [projetos, setProjetos] = useState<Projeto[]>([
    {
      id: "1",
      projetoID: "PRJ001",
      cliente: "João Silva",
      localizacao: "São Paulo, SP",
      dataInicio: "2024-01-15",
      dataPrevisao: "2024-03-15",
      status: "em-andamento",
      tipo: "Residencial",
      pacote: "Completo",
      m2: 150,
      valorTotal: 45000,
      arquiteto: "Ana Costa",
      briefing: "Projeto residencial moderno com foco em sustentabilidade",
    },
    {
      id: "2",
      projetoID: "PRJ002",
      cliente: "Maria Santos",
      localizacao: "Rio de Janeiro, RJ",
      dataInicio: "2024-02-01",
      dataPrevisao: "2024-04-01",
      status: "planejamento",
      tipo: "Comercial",
      pacote: "Premium",
      m2: 250,
      valorTotal: 75000,
      arquiteto: "Carlos Lima",
    },
  ]);

  const [clientes, setClientes] = useState<{id: string, nome: string}[]>([
    { id: "1", nome: "João Silva" },
    { id: "2", nome: "Maria Santos" },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formData, setFormData] = useState({
    projetoID: "",
    cliente: "",
    localizacao: "",
    dataInicio: "",
    dataPrevisao: "",
    tipo: "",
    pacote: "",
    m2: "",
    valorTotal: "",
    arquiteto: "",
    briefing: "",
  });
  const { toast } = useToast();
  
  const handleCardClick = (projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setIsDetailOpen(true);
  };

  useEffect(() => {
    const savedClientes = localStorage.getItem("vrz-financeiro-clientes");
    if (savedClientes) {
      const clientesData = JSON.parse(savedClientes);
      const clientesList = clientesData.map((cliente: any) => ({
        id: cliente.id,
        nome: cliente.nome
      }));
      setClientes(clientesList);
    }
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.projetoID || !formData.cliente) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos o ID do projeto e cliente",
        variant: "destructive",
      });
      return;
    }

    const novoProjeto: Projeto = {
      id: Date.now().toString(),
      ...formData,
      m2: parseFloat(formData.m2) || 0,
      valorTotal: parseFloat(formData.valorTotal) || 0,
      status: "planejamento",
    };

    setProjetos([...projetos, novoProjeto]);

    setFormData({
      projetoID: "",
      cliente: "",
      localizacao: "",
      dataInicio: "",
      dataPrevisao: "",
      tipo: "",
      pacote: "",
      m2: "",
      valorTotal: "",
      arquiteto: "",
      briefing: "",
    });
    setIsDialogOpen(false);

    toast({
      title: "Projeto cadastrado",
      description: "Novo projeto foi adicionado com sucesso",
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId as Projeto["status"];

    setProjetos((prevProjetos) =>
      prevProjetos.map((projeto) =>
        projeto.id === draggableId ? { ...projeto, status: newStatus } : projeto
      )
    );

    toast({
      title: "Status atualizado",
      description: `Projeto movido para ${statusConfig[newStatus].label}`,
    });
  };

  const getProjetosByStatus = (status: Projeto["status"]) => {
    return projetos.filter((projeto) => projeto.status === status);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Projetos</h1>
          <p className="text-sm text-black/60 mt-1">Gerencie seus projetos em formato Kanban</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md lg:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Projeto</DialogTitle>
              <DialogDescription>
                Cadastre um novo projeto no sistema
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projetoID">Projeto ID *</Label>
                  <Input
                    id="projetoID"
                    value={formData.projetoID}
                    onChange={(e) => handleInputChange("projetoID", e.target.value)}
                    placeholder="PRJ001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select 
                    value={formData.cliente} 
                    onValueChange={(value) => handleInputChange("cliente", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.nome}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="localizacao">Localização</Label>
                <Input
                  id="localizacao"
                  value={formData.localizacao}
                  onChange={(e) => handleInputChange("localizacao", e.target.value)}
                  placeholder="Cidade, Estado"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={formData.dataInicio}
                    onChange={(e) => handleInputChange("dataInicio", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataPrevisao">Data Previsão</Label>
                  <Input
                    id="dataPrevisao"
                    type="date"
                    value={formData.dataPrevisao}
                    onChange={(e) => handleInputChange("dataPrevisao", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(value) => handleInputChange("tipo", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Residencial">Residencial</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                      <SelectItem value="Industrial">Industrial</SelectItem>
                      <SelectItem value="Institucional">Institucional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pacote">Pacote</Label>
                  <Select value={formData.pacote} onValueChange={(value) => handleInputChange("pacote", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pacote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Básico">Básico</SelectItem>
                      <SelectItem value="Intermediário">Intermediário</SelectItem>
                      <SelectItem value="Completo">Completo</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="m2">M²</Label>
                  <Input
                    id="m2"
                    type="number"
                    value={formData.m2}
                    onChange={(e) => handleInputChange("m2", e.target.value)}
                    placeholder="150"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorTotal">Valor Total (R$)</Label>
                  <Input
                    id="valorTotal"
                    type="number"
                    step="0.01"
                    value={formData.valorTotal}
                    onChange={(e) => handleInputChange("valorTotal", e.target.value)}
                    placeholder="45000.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="arquiteto">Arquiteto</Label>
                <Input
                  id="arquiteto"
                  value={formData.arquiteto}
                  onChange={(e) => handleInputChange("arquiteto", e.target.value)}
                  placeholder="Nome do arquiteto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="briefing">Briefing</Label>
                <Textarea
                  id="briefing"
                  value={formData.briefing}
                  onChange={(e) => handleInputChange("briefing", e.target.value)}
                  placeholder="Descrição do projeto"
                  rows={3}
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

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex flex-col">
              <div className={`${config.columnColor} rounded-t-lg p-3 border-b border-black/10`}>
                <h3 className="font-medium text-sm flex items-center justify-between">
                  {config.label}
                  <Badge variant="secondary" className="ml-2">
                    {getProjetosByStatus(status as Projeto["status"]).length}
                  </Badge>
                </h3>
              </div>

              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 min-h-[300px] rounded-b-lg border border-t-0 ${
                      snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-50"
                    }`}
                  >
                    {getProjetosByStatus(status as Projeto["status"]).map((projeto, index) => (
                      <Draggable key={projeto.id} draggableId={projeto.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => handleCardClick(projeto)}
                            className={`cursor-pointer hover:shadow-md transition-shadow ${
                              snapshot.isDragging ? "shadow-lg rotate-2" : ""
                            }`}
                          >
                            <CardHeader className="p-3 pb-2">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {projeto.projetoID}
                                </Badge>
                                <Badge className={statusConfig[projeto.status].color}>
                                  {projeto.tipo}
                                </Badge>
                              </div>
                              <CardTitle className="text-sm font-medium">
                                {projeto.cliente}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-2">
                              {projeto.localizacao && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <MapPin size={12} className="flex-shrink-0" />
                                  <span className="line-clamp-1">{projeto.localizacao}</span>
                                </div>
                              )}
                              {projeto.dataPrevisao && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Calendar size={12} className="flex-shrink-0" />
                                  <span>Previsão: {formatDate(projeto.dataPrevisao)}</span>
                                </div>
                              )}
                              {projeto.arquiteto && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <User size={12} className="flex-shrink-0" />
                                  <span className="line-clamp-1">{projeto.arquiteto}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs font-medium text-green-600 pt-2 border-t">
                                <DollarSign size={12} className="flex-shrink-0" />
                                <span>{formatCurrency(projeto.valorTotal)}</span>
                              </div>
                              {projeto.m2 > 0 && (
                                <div className="text-xs text-black/50">
                                  {projeto.m2} m² • {projeto.pacote}
                                </div>
                              )}
                              {projeto.briefing && (
                                <p className="text-xs text-black/50 line-clamp-2 mt-2 pt-2 border-t">
                                  {projeto.briefing}
                                </p>
                              )}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProjeto && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl">Projeto {selectedProjeto.projetoID}</DialogTitle>
                  <Badge className={statusConfig[selectedProjeto.status].color}>
                    {statusConfig[selectedProjeto.status].label}
                  </Badge>
                </div>
                <DialogDescription>
                  Detalhes completos do projeto
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Informações Principais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Cliente</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User size={16} className="text-black/40" />
                      {selectedProjeto.cliente}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Localização</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={16} className="text-black/40" />
                      {selectedProjeto.localizacao || "Não informado"}
                    </div>
                  </div>
                </div>

                {/* Datas e Prazos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Data de Início</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={16} className="text-black/40" />
                      {formatDate(selectedProjeto.dataInicio) || "Não informado"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Previsão de Término</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={16} className="text-black/40" />
                      {formatDate(selectedProjeto.dataPrevisao) || "Não informado"}
                    </div>
                  </div>
                </div>

                {/* Tipo e Pacote */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Tipo</Label>
                    <p className="text-sm font-medium">{selectedProjeto.tipo}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Pacote</Label>
                    <p className="text-sm font-medium">{selectedProjeto.pacote}</p>
                  </div>
                </div>

                {/* Valores e Medidas */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-black/5 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Valor Total</Label>
                    <div className="flex items-center gap-2 text-lg font-bold text-green-600">
                      <DollarSign size={18} />
                      {formatCurrency(selectedProjeto.valorTotal)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Área</Label>
                    <p className="text-lg font-bold">{selectedProjeto.m2} m²</p>
                  </div>
                </div>

                {/* Responsável */}
                {selectedProjeto.arquiteto && (
                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Arquiteto Responsável</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <User size={16} className="text-black/40" />
                      {selectedProjeto.arquiteto}
                    </div>
                  </div>
                )}

                {/* Briefing */}
                {selectedProjeto.briefing && (
                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Briefing</Label>
                    <p className="text-sm text-black/70 bg-black/5 p-3 rounded-lg">
                      {selectedProjeto.briefing}
                    </p>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setIsDetailOpen(false)}
                  >
                    Fechar
                  </Button>
                  <Button 
                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                    onClick={() => {
                      setIsDetailOpen(false);
                      toast({
                        title: "Em desenvolvimento",
                        description: "Funcionalidade de edição em breve",
                      });
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
