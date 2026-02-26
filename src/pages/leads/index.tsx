import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mail, Phone, User, MapPin, CheckCircle2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPhone } from "@/lib/maskUtils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

interface Lead {
  id: string;
  nome: string;
  email?: string;
  contato?: string;
  status: "Novo" | "Em contato" | "Proposta" | "Negociação" | "Ganho" | "Perdido";
  origem?: string;
  cliente_id?: string;
}

const statusConfig: Record<string, { label: string, color: string, columnColor: string }> = {
  "Novo": { label: "Novo", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
  "Em contato": { label: "Em Contato", color: "bg-purple-100 text-purple-800", columnColor: "bg-purple-50" },
  "Proposta": { label: "Proposta Enviada", color: "bg-yellow-100 text-yellow-800", columnColor: "bg-yellow-50" },
  "Negociação": { label: "Em Negociação", color: "bg-accent-orange/10 text-accent-orange", columnColor: "bg-accent-orange/5" },
  "Ganho": { label: "Ganho", color: "bg-green-100 text-green-800", columnColor: "bg-green-50" },
  "Perdido": { label: "Perdido", color: "bg-red-100 text-red-800", columnColor: "bg-red-50" },
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    contato: "",
    origem: "",
  });
  const { toast } = useToast();

  

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setLeads(data as unknown as Lead[]);
    }
  };

  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do lead é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from('leads').insert({
        nome: formData.nome,
        email: formData.email,
        contato: formData.contato,
        origem: formData.origem,
        status: "Novo",
        empresa_id: (await supabase.rpc('get_user_empresa_id')).data
      });

      if (error) throw error;

      toast({
        title: "Lead cadastrado",
        description: "Novo lead foi adicionado com sucesso",
      });

      setFormData({
        nome: "",
        email: "",
        contato: "",
        origem: "",
      });
      setIsDialogOpen(false);
      fetchLeads();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;

    // Otimistic update
    const updatedLeads = leads.map((lead) =>
      lead.id === draggableId ? { ...lead, status: newStatus as Lead["status"] } : lead
    );
    setLeads(updatedLeads);

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', draggableId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Lead movido para ${newStatus}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive"
      });
      fetchLeads(); // Revert changes
    }
  };

  const handleConvertToClient = async () => {
    if (!selectedLead) return;

    if ((selectedLead as any).cliente_id) {
      toast({
        title: "Já convertido",
        description: "Este lead já foi convertido em cliente.",
        variant: "destructive",
      });
      setIsConvertOpen(false);
      return;
    }

    try {
      // 1. Create Client
      const { data: clientData, error: clientError } = await supabase.from('clientes').insert({
        nome: selectedLead.nome,
        email: selectedLead.email,
        contato: selectedLead.contato,
        origem: selectedLead.origem,
        empresa_id: (await supabase.rpc('get_user_empresa_id')).data
      }).select().single();

      if (clientError) throw clientError;

      // 2. Update Lead with status and cliente_id
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'Ganho',
          cliente_id: clientData.id
        })
        .eq('id', selectedLead.id);

      if (leadError) throw leadError;

      toast({
        title: "Sucesso!",
        description: `${selectedLead.nome} foi convertido em cliente.`,
      });

      setIsConvertOpen(false);
      setIsDetailOpen(false);
      fetchLeads();
    } catch (error: any) {
      toast({
        title: "Erro na conversão",
        description: error.message,
        variant: "destructive"
      });
    }
  };


  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (!error) {
      toast({ title: "Lead excluído" });
      setIsDetailOpen(false);
      fetchLeads();
    }
  };

  const getLeadsByStatus = (status: string) => {
    return leads.filter((lead) => lead.status === status);
  };

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Leads"
          description="Gerencie seus leads"
          children={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Lead</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo lead no sistema
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                    <Label htmlFor="contato">Contato (Celular)</Label>
                    <Input
                      id="contato"
                      value={formData.contato}
                      onChange={(e) => setFormData({ ...formData, contato: formatPhone(e.target.value) })}
                      maxLength={15}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="origem">Origem</Label>
                    <Select 
                      value={formData.origem} 
                      onValueChange={(value) => setFormData({ ...formData, origem: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a origem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Tráfego">Tráfego</SelectItem>
                        <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                        <SelectItem value="Pessoal">Pessoal</SelectItem>
                        <SelectItem value="Parceria">Parceria</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
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
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 w-full h-full min-h-0">
            {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex flex-col min-h-0">
              <div className={`${config.columnColor} rounded-t-lg p-3 border-b border-black/10`}>
                <h3 className="font-medium text-sm flex items-center justify-between">
                  {config.label}
                  <Badge variant="secondary" className="ml-2">
                    {getLeadsByStatus(status).length}
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
                    {getLeadsByStatus(status).map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => handleCardClick(lead)}
                            className={`cursor-pointer hover:shadow-md transition-shadow w-full ${snapshot.isDragging ? "shadow-lg rotate-2" : ""
                              }`}
                          >
                            <CardHeader className="p-3 pb-2">
                              <div className="flex justify-between items-start">
                                <CardTitle className="text-sm font-medium flex items-start gap-2">
                                  <User size={14} className="mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-1">{lead.nome}</span>
                                </CardTitle>
                                {lead.cliente_id && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 border-green-200">
                                    Cliente
                                  </Badge>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-1.5">
                              {lead.email && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Mail size={12} className="flex-shrink-0" />
                                  <span className="line-clamp-1">{lead.email}</span>
                                </div>
                              )}
                              {lead.contato && (
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Phone size={12} className="flex-shrink-0" />
                                  <span className="line-clamp-1">{lead.contato}</span>
                                </div>
                              )}
                              {lead.origem && (
                                <p className="text-xs text-black/50 line-clamp-2 mt-2 pt-2 border-t">
                                  Origem: {lead.origem}
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
                  <Badge className={statusConfig[selectedLead.status]?.color || "bg-gray-100"}>
                    {selectedLead.status}
                  </Badge>

                  {selectedLead.status === "Ganho" && !selectedLead.cliente_id && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white h-8"
                      onClick={() => setIsConvertOpen(true)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Transformar em Cliente
                    </Button>
                  )}
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

                  {selectedLead.email && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black/60">Email</Label>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={16} className="text-black/40" />
                        {selectedLead.email}
                      </div>
                    </div>
                  )}

                  {selectedLead.contato && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black/60">Contato</Label>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={16} className="text-black/40" />
                        {selectedLead.contato}
                      </div>
                    </div>
                  )}

                  {selectedLead.origem && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black/60">Origem</Label>
                      <p className="text-sm text-black/70 bg-black/5 p-3 rounded-lg">
                        {selectedLead.origem}
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
                  <Button variant="destructive" className="flex-1" onClick={() => handleDelete(selectedLead.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Conversão */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Conversão</DialogTitle>
            <DialogDescription>
              Deseja realmente transformar este lead em um cliente? Isso criará um novo registro na base de clientes e marcará o lead como Ganho.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsConvertOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConvertToClient} className="bg-green-600 hover:bg-green-700 text-white">
              Confirmar Conversão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
