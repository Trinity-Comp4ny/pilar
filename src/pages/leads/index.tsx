import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Mail,
  Phone,
  User,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  UserPlus,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatPhone } from "@/lib/maskUtils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import {
  useLeads,
  useCreateLead,
  useUpdateLeadStatus,
  useConvertLeadToClient,
  useDeleteLead,
  useCreatePropostaFromLead,
  useUpdateLead,
  type Lead,
} from "@/hooks/useLeads";

const statusConfig: Record<string, { label: string; color: string; columnColor: string }> = {
  Novo: { label: "Novo", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
  "Em contato": { label: "Em Contato", color: "bg-purple-100 text-purple-800", columnColor: "bg-purple-50" },
  Proposta: { label: "Proposta Enviada", color: "bg-yellow-100 text-yellow-800", columnColor: "bg-yellow-50" },
  Negociação: {
    label: "Em Negociação",
    color: "bg-brand/10 text-brand",
    columnColor: "bg-brand/5",
  },
  Ganho: { label: "Ganho", color: "bg-positive/10 text-positive", columnColor: "bg-positive/10" },
  Perdido: { label: "Perdido", color: "bg-red-100 text-red-800", columnColor: "bg-red-50" },
};

export default function Leads() {
  usePageTitle("Leads");
  const { data: leads = [] } = useLeads();
  const createLead = useCreateLead();
  const updateStatus = useUpdateLeadStatus();
  const convertToClient = useConvertLeadToClient();
  const deleteLead = useDeleteLead();
  const createProposta = useCreatePropostaFromLead();
  const updateLead = useUpdateLead();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    contato: "",
    origem: "",
  });
  const [editFormData, setEditFormData] = useState({
    nome: "",
    email: "",
    contato: "",
    origem: "",
  });
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; newStatus: string } | null>(null);
  const [isMotivoPerdasOpen, setIsMotivoPerdasOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [isAutoConvertOpen, setIsAutoConvertOpen] = useState(false);
  const [isCreatePropostaOpen, setIsCreatePropostaOpen] = useState(false);
  const queryClient = useQueryClient();
  const { canEdit } = useFeatureAccess("leads");
  const navigate = useNavigate();

  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome) {
      toast.error("Campo obrigatório", {
        description: "O nome do lead é obrigatório",
      });
      return;
    }

    createLead.mutate(
      {
        nome: formData.nome,
        email: formData.email,
        contato: formData.contato,
        origem: formData.origem,
      },
      {
        onSuccess: () => {
          setFormData({ nome: "", email: "", contato: "", origem: "" });
          setIsDialogOpen(false);
        },
      }
    );
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;

    // Interceptar: "Perdido" precisa de motivo
    if (newStatus === "Perdido") {
      setPendingDrop({ leadId: draggableId, newStatus });
      setMotivoPerda("");
      setIsMotivoPerdasOpen(true);
      return;
    }

    // Interceptar: "Ganho" oferece conversao automatica
    if (newStatus === "Ganho") {
      const lead = leads.find((l) => l.id === draggableId);
      if (lead && !lead.cliente_id) {
        setPendingDrop({ leadId: draggableId, newStatus });
        setIsAutoConvertOpen(true);
        return;
      }
    }

    // Para outros status, fluxo normal
    updateStatus.mutate({ leadId: draggableId, newStatus });
  };

  const handleConfirmMotivoPerdas = async () => {
    if (!pendingDrop || !motivoPerda.trim()) {
      toast.error("Motivo obrigatório", { description: "Informe o motivo da perda do lead." });
      return;
    }

    updateStatus.mutate(
      { leadId: pendingDrop.leadId, newStatus: "Perdido", extraFields: { motivo_perda: motivoPerda.trim() } },
      {
        onSuccess: () => {
          setIsMotivoPerdasOpen(false);
          setPendingDrop(null);
          setMotivoPerda("");
        },
      }
    );
  };

  const handleAutoConvert = async () => {
    if (!pendingDrop) return;

    convertToClient.mutate(pendingDrop.leadId, {
      onSuccess: () => {
        setIsAutoConvertOpen(false);
        setPendingDrop(null);
      },
    });
  };

  const handleSkipConvert = async () => {
    if (!pendingDrop) return;
    updateStatus.mutate(
      { leadId: pendingDrop.leadId, newStatus: "Ganho" },
      {
        onSuccess: () => {
          setIsAutoConvertOpen(false);
          setPendingDrop(null);
        },
      }
    );
  };

  const handleConvertToClient = async () => {
    if (!selectedLead) return;

    if (selectedLead.cliente_id) {
      toast.error("Já convertido", {
        description: "Este lead já foi convertido em cliente.",
      });
      setIsConvertOpen(false);
      return;
    }

    convertToClient.mutate(selectedLead.id, {
      onSuccess: () => {
        toast.success("Sucesso!", {
          description: `${selectedLead.nome} foi convertido em cliente.`,
        });
        setIsConvertOpen(false);
        setIsDetailOpen(false);
      },
    });
  };

  const handleCriarProposta = async (lead: Lead) => {
    createProposta.mutate(lead, {
      onSuccess: (proposta) => {
        setIsDetailOpen(false);
        navigate(`/documentos?edit=${proposta.id}`);
      },
    });
  };

  const handleDelete = async (id: string) => {
    deleteLead.mutate(id, {
      onSuccess: () => {
        setIsDetailOpen(false);
      },
    });
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditFormData({
      nome: lead.nome,
      email: lead.email ?? "",
      contato: lead.contato ?? "",
      origem: lead.origem ?? "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    updateLead.mutate(
      { id: selectedLead.id, data: editFormData },
      {
        onSuccess: () => {
          setSelectedLead({ ...selectedLead, ...editFormData });
          setIsEditOpen(false);
        },
      }
    );
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
              {canEdit && (
                <DialogTrigger asChild>
                  <Button className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Lead
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
                <div className="px-6 pt-6 pb-4">
                  <DialogHeader>
                    <DialogTitle>Novo Lead</DialogTitle>
                    <DialogDescription>Cadastre um novo lead no sistema</DialogDescription>
                  </DialogHeader>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                      Informações do Lead
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="nome" className="text-xs">
                          Nome *
                        </Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder="Nome completo"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contato" className="text-xs">
                          Celular
                        </Label>
                        <Input
                          id="contato"
                          value={formData.contato}
                          onChange={(e) => setFormData({ ...formData, contato: formatPhone(e.target.value) })}
                          maxLength={15}
                          placeholder="(14) 99999-9999"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="origem" className="text-xs">
                          Origem
                        </Label>
                        <Input
                          id="origem"
                          value={formData.origem}
                          onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                          placeholder="Ex: Instagram, LinkedIn, Indicação..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 px-6 py-4 bg-gray-50/30">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1"
                      disabled={createLead.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-brand hover:bg-brand/90 text-ink"
                      disabled={createLead.isPending}
                    >
                      {createLead.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
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
          <div className="flex gap-4 w-full h-full min-h-0 overflow-x-auto pb-2">
            {Object.entries(statusConfig).map(([status, config]) => (
              <div key={status} className="flex flex-col min-w-[340px] w-[340px] flex-shrink-0 min-h-0">
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
                      className={`flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-b-lg border border-t-0 ${
                        snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-50"
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
                              className={`cursor-pointer hover:shadow-md transition-shadow w-full ${
                                snapshot.isDragging ? "shadow-lg rotate-2" : ""
                              }`}
                            >
                              <CardHeader className="p-3 pb-2">
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-base font-medium flex items-start gap-2">
                                    <User size={16} className="mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-1">{lead.nome}</span>
                                  </CardTitle>
                                  {lead.cliente_id && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs h-5 px-1.5 bg-positive/10 text-positive border-positive/20"
                                    >
                                      Cliente
                                    </Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="p-3 pt-0 space-y-1.5">
                                {lead.email && (
                                  <div className="flex items-center gap-2 text-sm text-black/60">
                                    <Mail size={14} className="flex-shrink-0" />
                                    <span className="line-clamp-1">{lead.email}</span>
                                  </div>
                                )}
                                {lead.contato && (
                                  <div className="flex items-center gap-2 text-sm text-black/60">
                                    <Phone size={14} className="flex-shrink-0" />
                                    <span className="line-clamp-1">{lead.contato}</span>
                                  </div>
                                )}
                                {lead.origem && (
                                  <p className="text-sm text-black/50 line-clamp-1 mt-2 pt-2 border-t">
                                    Origem: {lead.origem}
                                  </p>
                                )}
                                {lead.status === "Perdido" && lead.motivo_perda && (
                                  <p className="text-sm text-red-500/80 line-clamp-2 mt-1 pt-1 border-t border-red-100">
                                    Motivo: {lead.motivo_perda}
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
                <DialogDescription>Informações completas sobre o lead</DialogDescription>
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
                      className="bg-positive hover:bg-positive/90 text-white h-8"
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
                      <p className="text-sm text-black/70 bg-black/5 p-3 rounded-lg">{selectedLead.origem}</p>
                    </div>
                  )}

                  {selectedLead.status === "Perdido" && selectedLead.motivo_perda && (
                    <div className="space-y-2">
                      <Label className="text-xs text-red-500">Motivo da Perda</Label>
                      <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
                        {selectedLead.motivo_perda}
                      </p>
                    </div>
                  )}

                  {selectedLead.convertido_em && (
                    <div className="space-y-2">
                      <Label className="text-xs text-positive">Convertido em</Label>
                      <p className="text-sm text-positive bg-positive/10 p-3 rounded-lg border border-positive/10">
                        {new Date(selectedLead.convertido_em).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button
                    className="bg-brand hover:bg-brand/90 text-ink"
                    onClick={() => setIsCreatePropostaOpen(true)}
                    disabled={
                      createProposta.isPending || selectedLead.status === "Perdido" || selectedLead.status === "Ganho"
                    }
                  >
                    {createProposta.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Criar Proposta
                  </Button>

                  <div className="flex-1" />

                  {canEdit && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(selectedLead)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(selectedLead.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição do Lead */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle>Editar Lead</DialogTitle>
              <DialogDescription>Atualize as informações do lead</DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleEditSubmit}>
            <div className="px-6 py-4 space-y-3">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Informações do Lead</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-nome" className="text-xs">
                    Nome *
                  </Label>
                  <Input
                    id="edit-nome"
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-contato" className="text-xs">
                    Celular
                  </Label>
                  <Input
                    id="edit-contato"
                    value={editFormData.contato}
                    onChange={(e) => setEditFormData({ ...editFormData, contato: formatPhone(e.target.value) })}
                    maxLength={15}
                    placeholder="(14) 99999-9999"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-origem" className="text-xs">
                    Origem
                  </Label>
                  <Input
                    id="edit-origem"
                    value={editFormData.origem}
                    onChange={(e) => setEditFormData({ ...editFormData, origem: e.target.value })}
                    placeholder="Ex: Instagram, LinkedIn, Indicação..."
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 bg-gray-50/30">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="flex-1"
                disabled={updateLead.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-brand hover:bg-brand/90 text-ink"
                disabled={updateLead.isPending}
              >
                {updateLead.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Conversão (via detalhe) */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Conversão</DialogTitle>
            <DialogDescription>
              Deseja realmente transformar este lead em um cliente? Isso criará um novo registro na base de clientes e
              marcará o lead como Ganho.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsConvertOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConvertToClient} className="bg-positive hover:bg-positive/90 text-white">
              Confirmar Conversão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Motivo de Perda (drag para Perdido) */}
      <Dialog
        open={isMotivoPerdasOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDrop(null);
            setMotivoPerda("");
          }
          setIsMotivoPerdasOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Motivo da Perda
            </DialogTitle>
            <DialogDescription>
              Por que este lead foi perdido? Isso ajuda a analisar seu funil comercial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea
              value={motivoPerda}
              onChange={(e) => setMotivoPerda(e.target.value)}
              placeholder="Ex: Preço acima do orçamento, escolheu concorrente, projeto cancelado..."
              rows={3}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsMotivoPerdasOpen(false);
                setPendingDrop(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmMotivoPerdas} variant="destructive" disabled={!motivoPerda.trim()}>
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação Criar Proposta */}
      <Dialog open={isCreatePropostaOpen} onOpenChange={setIsCreatePropostaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand" />
              Criar Proposta
            </DialogTitle>
            <DialogDescription>
              Deseja criar uma proposta para <span className="font-medium text-foreground">{selectedLead?.nome}</span>?
              Você será redirecionado para o editor de propostas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsCreatePropostaOpen(false)}
              disabled={createProposta.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="bg-brand hover:bg-brand/90 text-ink"
              onClick={() => {
                setIsCreatePropostaOpen(false);
                if (selectedLead) handleCriarProposta(selectedLead);
              }}
              disabled={createProposta.isPending}
            >
              {createProposta.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Conversão Automática (drag para Ganho) */}
      <Dialog
        open={isAutoConvertOpen}
        onOpenChange={(open) => {
          if (!open && pendingDrop) {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setPendingDrop(null);
          }
          setIsAutoConvertOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-positive" />
              Lead Ganho!
            </DialogTitle>
            <DialogDescription>
              Deseja criar um cliente automaticamente a partir deste lead? Os dados de contato serão copiados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={handleSkipConvert}>
              Apenas marcar como Ganho
            </Button>
            <Button
              onClick={handleAutoConvert}
              className="bg-positive hover:bg-positive/90 text-white"
              disabled={convertToClient.isPending}
            >
              {convertToClient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Convertendo...
                </>
              ) : (
                "Criar Cliente"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
