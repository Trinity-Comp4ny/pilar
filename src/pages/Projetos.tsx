import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, User, MapPin, DollarSign, Trash2, HardHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";

interface ProjetoTecnico {
  tipo: string;
  responsavel: string;
}

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
  briefing: string; // "Sim" | "Não"
  placa: string; // "Sim" | "Não"
  observacao: string;
  projetosTecnicos: ProjetoTecnico[];
}

const statusConfig = {
  planejamento: { label: "Planejamento", color: "bg-yellow-100 text-yellow-800", columnColor: "bg-yellow-50" },
  "em-andamento": { label: "Em Andamento", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
  "em-revisao": { label: "Em Revisão", color: "bg-purple-100 text-purple-800", columnColor: "bg-purple-50" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800", columnColor: "bg-green-50" },
  pausado: { label: "Pausado", color: "bg-orange-100 text-orange-800", columnColor: "bg-orange-50" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800", columnColor: "bg-red-50" },
};

const tiposProjetosTecnicos = [
  "Estrutural",
  "Estrutura Metálica",
  "Alvenaria Estrutural",
  "Elétrico",
  "Hidráulico",
  "Hidrossanitário",
  "Automação",
  "Climatização, Exaustão e Renovação de Ar",
  "Gases Medicinais",
  "Sistema Fotovoltaico",
  "Prevenção e Combate a Incêndio (PPCI)",
  "Auto de Vistoria do Corpo de Bombeiros (AVCB)",
  "Sistema de Proteção contra Descargas Atmosféricas (SPDA)"
];

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
      briefing: "Sim",
      placa: "Sim",
      observacao: "Projeto com foco em sustentabilidade.",
      projetosTecnicos: [
        { tipo: "Estrutural", responsavel: "Eng. Roberto" },
        { tipo: "Elétrico", responsavel: "Eng. Carlos" }
      ]
    },
  ]);

  const [clientes, setClientes] = useState<{id: string, nome: string}[]>([
    { id: "1", nome: "João Silva" },
    { id: "2", nome: "Maria Santos" },
  ]);

  // Mock de pessoas para responsáveis técnicos
  const [pessoas, setPessoas] = useState<{id: string, nome: string}[]>([
    { id: "1", nome: "Ana Costa" },
    { id: "2", nome: "Carlos Lima" },
    { id: "3", nome: "Roberto Engenheiro" },
    { id: "4", nome: "Fernanda Arquiteta" },
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
    briefing: "Não",
    placa: "Não",
    observacao: "",
  });

  const [tempTecnico, setTempTecnico] = useState({ tipo: "", responsavel: "" });
  const [projetosTecnicos, setProjetosTecnicos] = useState<ProjetoTecnico[]>([]);

  const { toast } = useToast();
  
  const handleCardClick = (projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setIsDetailOpen(true);
  };

  useEffect(() => {
    const savedClientes = localStorage.getItem("vrz-financeiro-clientes");
    if (savedClientes) {
      const clientesData = JSON.parse(savedClientes);
      setClientes(clientesData.map((c: any) => ({ id: c.id, nome: c.nome })));
    }
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addProjetoTecnico = () => {
    if (tempTecnico.tipo && tempTecnico.responsavel) {
      setProjetosTecnicos([...projetosTecnicos, tempTecnico]);
      setTempTecnico({ tipo: "", responsavel: "" });
    }
  };

  const removeProjetoTecnico = (index: number) => {
    const newTecnicos = [...projetosTecnicos];
    newTecnicos.splice(index, 1);
    setProjetosTecnicos(newTecnicos);
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
      projetosTecnicos: projetosTecnicos
    };

    setProjetos([...projetos, novoProjeto]);

    // Reset form
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
      briefing: "Não",
      placa: "Não",
      observacao: "",
    });
    setProjetosTecnicos([]);
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
    <PageLayout
      header={
        <PageHeader 
          title="Projetos" 
          description="Gerencie seus projetos em formato Kanban"
          children={
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

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="localizacao">Localização</Label>
                    <Input
                      id="localizacao"
                      value={formData.localizacao}
                      onChange={(e) => handleInputChange("localizacao", e.target.value)}
                      placeholder="Cidade, Estado"
                    />
                  </div>

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

                  <div className="space-y-2">
                    <Label htmlFor="briefing">Briefing</Label>
                    <Select value={formData.briefing} onValueChange={(value) => handleInputChange("briefing", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="placa">Placa</Label>
                    <Select value={formData.placa} onValueChange={(value) => handleInputChange("placa", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seção de Projetos Técnicos */}
                  <div className="space-y-2 md:col-span-2 border-t pt-4">
                    <Label>Responsáveis Técnicos</Label>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Tipo de Projeto</Label>
                        <Select value={tempTecnico.tipo} onValueChange={(val) => setTempTecnico({...tempTecnico, tipo: val})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposProjetosTecnicos.map(tipo => (
                              <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Responsável</Label>
                        <Select value={tempTecnico.responsavel} onValueChange={(val) => setTempTecnico({...tempTecnico, responsavel: val})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a pessoa" />
                          </SelectTrigger>
                          <SelectContent>
                            {pessoas.map(pessoa => (
                              <SelectItem key={pessoa.id} value={pessoa.nome}>{pessoa.nome}</SelectItem>
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
                            <span className="font-medium">{pt.tipo}: <span className="font-normal text-gray-600">{pt.responsavel}</span></span>
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
                    {getProjetosByStatus(status as Projeto["status"]).length}
                  </Badge>
                </h3>
              </div>

              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 min-h-[200px] rounded-b-lg border border-t-0 ${
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
                            className={`cursor-pointer hover:shadow-md transition-shadow w-full ${
                              snapshot.isDragging ? "shadow-lg rotate-2" : ""
                            }`}
                          >
                            <CardHeader className="p-3 pb-2">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <Badge variant="outline" className="text-xs font-mono">
                                  {projeto.projetoID}
                                </Badge>
                                <Badge className={statusConfig[projeto.status].color}>
                                  {projeto.tipo}
                                </Badge>
                              </div>
                              <CardTitle className="text-sm font-medium line-clamp-2">
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
                              
                              {projeto.projetosTecnicos && projeto.projetosTecnicos.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {projeto.projetosTecnicos.slice(0, 2).map((pt, i) => (
                                    <span key={i} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 flex items-center gap-1">
                                      <HardHat size={8} /> {pt.tipo}
                                    </span>
                                  ))}
                                  {projeto.projetosTecnicos.length > 2 && (
                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                      +{projeto.projetosTecnicos.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between text-xs font-medium text-green-600 pt-2 border-t">
                                <div className="flex items-center gap-1">
                                  <DollarSign size={12} className="flex-shrink-0" />
                                  <span>{formatCurrency(projeto.valorTotal)}</span>
                                </div>
                                {projeto.m2 > 0 && (
                                  <span className="text-black/50 font-normal">{projeto.m2} m²</span>
                                )}
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
                  <DialogTitle className="text-xl">Projeto {selectedProjeto.projetoID}</DialogTitle>
                  <Badge className={statusConfig[selectedProjeto.status].color}>
                    {statusConfig[selectedProjeto.status].label}
                  </Badge>
                </div>
                <DialogDescription>
                  Detalhes completos do projeto
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cliente</Label>
                    <div className="font-medium flex items-center gap-2">
                      <User size={14} /> {selectedProjeto.cliente}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Localização</Label>
                    <div className="font-medium flex items-center gap-2">
                      <MapPin size={14} /> {selectedProjeto.localizacao}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Briefing</Label>
                    <Badge variant={selectedProjeto.briefing === "Sim" ? "default" : "outline"}>
                      {selectedProjeto.briefing || "Não"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Placa</Label>
                    <Badge variant={selectedProjeto.placa === "Sim" ? "default" : "outline"}>
                      {selectedProjeto.placa || "Não"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Área</Label>
                    <div className="font-medium">{selectedProjeto.m2} m²</div>
                  </div>
                </div>

                {selectedProjeto.projetosTecnicos && selectedProjeto.projetosTecnicos.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Responsáveis Técnicos</Label>
                    <div className="space-y-2">
                      {selectedProjeto.projetosTecnicos.map((pt, idx) => (
                        <div key={idx} className="flex justify-between text-sm border-b pb-1 last:border-0">
                          <span className="text-gray-600">{pt.tipo}</span>
                          <span className="font-medium">{pt.responsavel}</span>
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
