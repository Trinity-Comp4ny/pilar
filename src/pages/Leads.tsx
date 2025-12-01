import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Phone, Building2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface Lead {
  id: string;
  nome: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  observacoes?: string;
  status: "novo" | "contato" | "proposta" | "negociacao" | "ganho" | "perdido";
}

const statusConfig = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
  contato: { label: "Em Contato", color: "bg-purple-100 text-purple-800", columnColor: "bg-purple-50" },
  proposta: { label: "Proposta Enviada", color: "bg-yellow-100 text-yellow-800", columnColor: "bg-yellow-50" },
  negociacao: { label: "Em Negociação", color: "bg-orange-100 text-orange-800", columnColor: "bg-orange-50" },
  ganho: { label: "Ganho", color: "bg-green-100 text-green-800", columnColor: "bg-green-50" },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-800", columnColor: "bg-red-50" },
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: "1",
      nome: "Maria Silva",
      empresa: "Tech Solutions",
      email: "maria@techsolutions.com",
      telefone: "(11) 98765-4321",
      observacoes: "Interessada em projeto residencial",
      status: "novo",
    },
    {
      id: "2",
      nome: "João Santos",
      empresa: "Construções ABC",
      email: "joao@construcoesabc.com",
      telefone: "(11) 91234-5678",
      observacoes: "Projeto comercial de grande porte",
      status: "contato",
    },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    empresa: "",
    email: "",
    telefone: "",
    observacoes: "",
  });
  const { toast } = useToast();
  
  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do lead é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const novoLead: Lead = {
      id: Date.now().toString(),
      ...formData,
      status: "novo",
    };

    setLeads([...leads, novoLead]);

    setFormData({
      nome: "",
      empresa: "",
      email: "",
      telefone: "",
      observacoes: "",
    });
    setIsDialogOpen(false);

    toast({
      title: "Lead cadastrado",
      description: "Novo lead foi adicionado com sucesso",
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId as Lead["status"];
    
    setLeads((prevLeads) =>
      prevLeads.map((lead) =>
        lead.id === draggableId ? { ...lead, status: newStatus } : lead
      )
    );

    toast({
      title: "Status atualizado",
      description: `Lead movido para ${statusConfig[newStatus].label}`,
    });
  };

  const getLeadsByStatus = (status: Lead["status"]) => {
    return leads.filter((lead) => lead.status === status);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Leads</h1>
          <p className="text-sm text-black/60 mt-1">Gerencie seus leads em formato Kanban</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Lead</DialogTitle>
              <DialogDescription>
                Cadastre um novo lead no sistema
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do lead"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Input
                  id="empresa"
                  value={formData.empresa}
                  onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 98765-4321"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre o lead"
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
                    {getLeadsByStatus(status as Lead["status"]).length}
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
                    {getLeadsByStatus(status as Lead["status"]).map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => handleCardClick(lead)}
                            className={`cursor-pointer hover:shadow-md transition-shadow ${
                              snapshot.isDragging ? "shadow-lg rotate-2" : ""
                            }`}
                          >
                            <CardHeader className="p-3 pb-2">
                              <CardTitle className="text-sm font-medium flex items-start gap-2">
                                <User size={14} className="mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-1">{lead.nome}</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-1.5">
                              {lead.empresa && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Building2 size={12} className="flex-shrink-0" />
                                  <span className="line-clamp-1">{lead.empresa}</span>
                                </div>
                              )}
                              {lead.email && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Mail size={12} className="flex-shrink-0" />
                                  <span className="line-clamp-1">{lead.email}</span>
                                </div>
                              )}
                              {lead.telefone && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Phone size={12} className="flex-shrink-0" />
                                  <span className="line-clamp-1">{lead.telefone}</span>
                                </div>
                              )}
                              {lead.observacoes && (
                                <p className="text-xs text-black/50 line-clamp-2 mt-2 pt-2 border-t">
                                  {lead.observacoes}
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

      {/* Modal de Detalhes do Lead */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Detalhes do Lead</DialogTitle>
                <DialogDescription>
                  Informações completas sobre o lead
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge className={statusConfig[selectedLead.status].color}>
                    {statusConfig[selectedLead.status].label}
                  </Badge>
                </div>

                {/* Informações */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-black/60">Nome</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User size={16} className="text-black/40" />
                      {selectedLead.nome}
                    </div>
                  </div>

                  {selectedLead.empresa && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black/60">Empresa</Label>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 size={16} className="text-black/40" />
                        {selectedLead.empresa}
                      </div>
                    </div>
                  )}

                  {selectedLead.email && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black/60">Email</Label>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={16} className="text-black/40" />
                        {selectedLead.email}
                      </div>
                    </div>
                  )}

                  {selectedLead.telefone && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black/60">Telefone</Label>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={16} className="text-black/40" />
                        {selectedLead.telefone}
                      </div>
                    </div>
                  )}

                  {selectedLead.observacoes && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black/60">Observações</Label>
                      <p className="text-sm text-black/70 bg-black/5 p-3 rounded-lg">
                        {selectedLead.observacoes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-4">
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
