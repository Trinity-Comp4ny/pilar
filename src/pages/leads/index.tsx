import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Mail,
  Phone,
  User,
  Loader2,
  AlertTriangle,
  UserPlus,
  FileText,
  ArrowRight,
  MoreVertical,
  TrendingUp,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatPhone } from "@/lib/maskUtils";
import { formatCurrencyInput, parseCurrencyString, formatCurrency } from "@/lib/currencyUtils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LeadsKPIs } from "./LeadsKPIs";
import { LeadDetailDialog } from "./components/LeadDetailDialog";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import {
  useLeads,
  useCreateLead,
  useUpdateLeadStatus,
  useConvertLeadToClient,
  useDeleteLead,
  useCreatePropostaFromLead,
  useUpdateLead,
  useLeadMembers,
  type Lead,
} from "@/hooks/useLeads";

const statusConfig: Record<string, { label: string; color: string }> = {
  Novo: { label: "Novo", color: "bg-info-soft text-info-strong" },
  "Em contato": { label: "Em Contato", color: "bg-highlight-soft text-highlight-strong" },
  Proposta: { label: "Proposta Enviada", color: "bg-warning-soft text-warning-strong" },
  Negociação: { label: "Em Negociação", color: "bg-brand/10 text-brand" },
  Ganho: { label: "Ganho", color: "bg-positive/10 text-positive" },
  Perdido: { label: "Perdido", color: "bg-danger-soft text-danger-strong" },
};

const STATUS_DOT: Record<string, string> = {
  Novo: "bg-pipeline-novo",
  "Em contato": "bg-pipeline-contato",
  Proposta: "bg-pipeline-negociacao",
  Negociação: "bg-brand",
  Ganho: "bg-status-done",
  Perdido: "bg-status-cancelled",
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

  const { data: members = [] } = useLeadMembers();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    sobrenome: "",
    email: "",
    contato: "",
    origem: "",
    valor_estimado: "",
    empresa_lead: "",
    previsao_fechamento: "",
    responsavel_id: "",
    notas: "",
  });
  const [editFormData, setEditFormData] = useState({
    nome: "",
    sobrenome: "",
    email: "",
    contato: "",
    origem: "",
    valor_estimado: "",
    empresa_lead: "",
    previsao_fechamento: "",
    responsavel_id: "",
    notas: "",
  });
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; newStatus: string } | null>(null);
  const [isMotivoPerdasOpen, setIsMotivoPerdasOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [isAutoConvertOpen, setIsAutoConvertOpen] = useState(false);
  const [isCreatePropostaOpen, setIsCreatePropostaOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [filterProximos, setFilterProximos] = useState(false);
  const queryClient = useQueryClient();

  const toggleColumn = (status: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };
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
        sobrenome: formData.sobrenome || undefined,
        email: formData.email,
        contato: formData.contato,
        origem: formData.origem,
        valor_estimado: formData.valor_estimado ? parseCurrencyString(formData.valor_estimado) : undefined,
        empresa_lead: formData.empresa_lead || undefined,
        previsao_fechamento: formData.previsao_fechamento || undefined,
        responsavel_id: formData.responsavel_id || undefined,
        notas: formData.notas || undefined,
      },
      {
        onSuccess: () => {
          setFormData({
            nome: "",
            sobrenome: "",
            email: "",
            contato: "",
            origem: "",
            valor_estimado: "",
            empresa_lead: "",
            previsao_fechamento: "",
            responsavel_id: "",
            notas: "",
          });
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
          description: `${leadNome(selectedLead)} foi convertido em cliente.`,
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

  const handleDelete = (id: string) => {
    const lead = leads.find((l) => l.id === id);
    setLeadToDelete({ id, nome: lead ? `${lead.nome}${lead.sobrenome ? " " + lead.sobrenome : ""}` : "Lead" });
  };

  const handleDeleteConfirm = () => {
    if (!leadToDelete) return;
    deleteLead.mutate(leadToDelete.id, {
      onSuccess: () => {
        setIsDetailOpen(false);
        setLeadToDelete(null);
      },
    });
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditFormData({
      nome: lead.nome,
      sobrenome: lead.sobrenome ?? "",
      email: lead.email ?? "",
      contato: lead.contato ?? "",
      origem: lead.origem ?? "",
      valor_estimado: lead.valor_estimado ? formatCurrency(lead.valor_estimado) : "",
      empresa_lead: lead.empresa_lead ?? "",
      previsao_fechamento: lead.previsao_fechamento ?? "",
      responsavel_id: lead.responsavel_id ?? "",
      notas: lead.notas ?? "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    const payload = {
      nome: editFormData.nome,
      sobrenome: editFormData.sobrenome || undefined,
      email: editFormData.email,
      contato: editFormData.contato,
      origem: editFormData.origem,
      valor_estimado: editFormData.valor_estimado ? parseCurrencyString(editFormData.valor_estimado) : undefined,
      empresa_lead: editFormData.empresa_lead || undefined,
      previsao_fechamento: editFormData.previsao_fechamento || undefined,
      responsavel_id: editFormData.responsavel_id || undefined,
      notas: editFormData.notas || undefined,
    };
    updateLead.mutate(
      { id: selectedLead.id, data: payload },
      {
        onSuccess: () => {
          setSelectedLead({ ...selectedLead, ...payload });
          setIsEditOpen(false);
        },
      }
    );
  };

  const getLeadsByStatus = (status: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    return leads.filter((lead) => {
      if (lead.status !== status) return false;
      if (!filterProximos) return true;
      if (!lead.previsao_fechamento) return false;
      const d = new Date(lead.previsao_fechamento + "T00:00:00");
      return d >= today && d <= in7;
    });
  };

  const leadNome = (lead: Lead) => (lead.sobrenome ? `${lead.nome} ${lead.sobrenome}` : lead.nome);

  const hasNoLeads = leads.length === 0;
  const visibleCount = Object.keys(statusConfig).reduce((sum, s) => sum + getLeadsByStatus(s).length, 0);
  const hasNoResults = !hasNoLeads && visibleCount === 0;

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
                          placeholder="Primeiro nome"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sobrenome" className="text-xs">
                          Sobrenome
                        </Label>
                        <Input
                          id="sobrenome"
                          value={formData.sobrenome}
                          onChange={(e) => setFormData({ ...formData, sobrenome: e.target.value })}
                          placeholder="Sobrenome"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="empresa_lead" className="text-xs">
                          Empresa
                        </Label>
                        <Input
                          id="empresa_lead"
                          value={formData.empresa_lead}
                          onChange={(e) => setFormData({ ...formData, empresa_lead: e.target.value })}
                          placeholder="Nome da empresa"
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
                        <Label htmlFor="valor_estimado" className="text-xs">
                          Valor Estimado
                        </Label>
                        <Input
                          id="valor_estimado"
                          value={formData.valor_estimado}
                          onChange={(e) =>
                            setFormData({ ...formData, valor_estimado: formatCurrencyInput(e.target.value) })
                          }
                          placeholder="R$ 0,00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="previsao_fechamento" className="text-xs">
                          Previsão de Fechamento
                        </Label>
                        <DatePicker
                          id="previsao_fechamento"
                          value={formData.previsao_fechamento}
                          onChange={(v) => setFormData({ ...formData, previsao_fechamento: v })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="responsavel_id" className="text-xs">
                          Responsável
                        </Label>
                        <Select
                          value={formData.responsavel_id}
                          onValueChange={(v) => setFormData({ ...formData, responsavel_id: v })}
                        >
                          <SelectTrigger id="responsavel_id">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.first_name} {m.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                    <div className="space-y-1.5">
                      <Label htmlFor="notas" className="text-xs">
                        Notas
                      </Label>
                      <Textarea
                        id="notas"
                        value={formData.notas}
                        onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                        placeholder="Observações internas sobre o lead..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 px-6 py-4 bg-muted/30">
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
      <LeadsKPIs leads={leads} onFilterProximos={() => setFilterProximos((v) => !v)} />

      {filterProximos && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs text-warning-mid bg-warning-soft border border-warning-mid-border rounded-full px-3 py-0.5">
            Filtro: fechamentos nos próximos 7 dias
          </span>
          <button onClick={() => setFilterProximos(false)} className="text-xs text-muted-foreground underline">
            limpar
          </button>
        </div>
      )}

      {hasNoLeads ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={TrendingUp}
            title="Nenhum lead cadastrado"
            description="Comece capturando seu primeiro lead para acompanhar oportunidades no pipeline."
            action={
              canEdit
                ? {
                    label: "Criar Primeiro Lead",
                    onClick: () => setIsDialogOpen(true),
                  }
                : undefined
            }
          />
        </div>
      ) : hasNoResults ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={Search}
            title="Nenhum resultado para esses filtros"
            description="Tente ajustar ou limpar os filtros aplicados para ver seus leads."
            action={{
              label: "Limpar filtros",
              onClick: () => setFilterProximos(false),
              variant: "outline",
            }}
          />
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 min-h-0">
            {/* Desktop kanban */}
            <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
              {Object.entries(statusConfig).map(([status, config]) => {
                const items = getLeadsByStatus(status);
                const isCollapsed = collapsedColumns.has(status);
                const dotColor = STATUS_DOT[status] || "bg-pipeline-perdido";

                if (isCollapsed) {
                  return (
                    <div
                      key={status}
                      className="flex flex-col w-10 flex-shrink-0 min-h-0 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleColumn(status)}
                    >
                      <div className="flex flex-col items-center gap-2 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <span
                          className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                          {config.label} · {items.length}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={status} className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 min-h-0">
                    <div className="flex items-center gap-2 px-2 py-2.5 group">
                      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
                      <h3 className="text-xs font-medium text-foreground/80 uppercase tracking-wide">{config.label}</h3>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
                      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => toggleColumn(status)}
                          title="Minimizar coluna"
                          aria-label="Minimizar coluna"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-lg bg-muted/30 transition-all",
                            snapshot.isDraggingOver && "ring-2 ring-brand/40 bg-brand/5"
                          )}
                        >
                          {items.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex items-center justify-center py-8 px-2 text-center text-[11px] text-muted-foreground/70 border border-dashed border-muted-foreground/20 rounded-md">
                              Arraste leads para cá
                            </div>
                          )}
                          {items.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => handleCardClick(lead)}
                                  className={cn(
                                    "cursor-pointer hover:shadow-md transition-shadow w-full",
                                    snapshot.isDragging && "shadow-lg opacity-90"
                                  )}
                                >
                                  <CardHeader className="p-3 pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="flex-1 min-w-0">
                                        <CardTitle className="text-base font-medium flex items-start gap-2">
                                          <User size={16} className="mt-0.5 flex-shrink-0" />
                                          <span className="line-clamp-1">{leadNome(lead)}</span>
                                        </CardTitle>
                                        {lead.empresa_lead && (
                                          <p className="text-xs text-muted-foreground mt-0.5 ml-6 line-clamp-1">
                                            {lead.empresa_lead}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        {lead.cliente_id && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs h-5 px-1.5 bg-brand text-ink border-brand/40"
                                          >
                                            Cliente
                                          </Badge>
                                        )}
                                        {lead.valor_estimado != null && (
                                          <span className="text-xs font-semibold text-brand tabular-nums">
                                            {formatCurrency(lead.valor_estimado)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="p-3 pt-0 space-y-1.5">
                                    {lead.email && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Mail size={14} className="flex-shrink-0" />
                                        <span className="line-clamp-1">{lead.email}</span>
                                      </div>
                                    )}
                                    {lead.contato && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Phone size={14} className="flex-shrink-0" />
                                        <span className="line-clamp-1">{lead.contato}</span>
                                      </div>
                                    )}
                                    {lead.origem && (
                                      <p className="text-sm text-muted-foreground line-clamp-1 mt-2 pt-2 border-t">
                                        Origem: {lead.origem}
                                      </p>
                                    )}
                                    {lead.status === "Perdido" && lead.motivo_perda && (
                                      <p className="text-sm text-chart-danger/80 line-clamp-2 mt-1 pt-1 border-t border-danger-soft-border">
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
                );
              })}
            </div>

            {/* Mobile list view */}
            <div className="md:hidden space-y-3">
              {Object.entries(statusConfig).map(([status, config]) => {
                const items = getLeadsByStatus(status);
                const dotColor = STATUS_DOT[status] || "bg-pipeline-perdido";
                if (items.length === 0) return null;
                return (
                  <details key={status} open className="border rounded-lg bg-white">
                    <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none">
                      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
                      <span className="text-xs font-medium uppercase tracking-wide flex-1">{config.label}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </summary>
                    <div className="p-2 space-y-2 border-t bg-muted/20">
                      {items.map((lead) => (
                        <Card
                          key={lead.id}
                          onClick={() => handleCardClick(lead)}
                          className="cursor-pointer hover:shadow-md transition-shadow w-full"
                        >
                          <CardHeader className="p-3 pb-2">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base font-medium flex items-start gap-2">
                                  <User size={16} className="mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-1">{leadNome(lead)}</span>
                                </CardTitle>
                                {lead.empresa_lead && (
                                  <p className="text-xs text-muted-foreground mt-0.5 ml-6 line-clamp-1">
                                    {lead.empresa_lead}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {lead.cliente_id && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs h-5 px-1.5 bg-positive/10 text-positive border-positive/20"
                                  >
                                    Cliente
                                  </Badge>
                                )}
                                {lead.valor_estimado != null && (
                                  <span className="text-xs font-semibold text-brand tabular-nums">
                                    {formatCurrency(lead.valor_estimado)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-1.5">
                            {lead.email && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail size={14} className="flex-shrink-0" />
                                <span className="line-clamp-1">{lead.email}</span>
                              </div>
                            )}
                            {lead.contato && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone size={14} className="flex-shrink-0" />
                                <span className="line-clamp-1">{lead.contato}</span>
                              </div>
                            )}
                            {lead.origem && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-2 pt-2 border-t">
                                Origem: {lead.origem}
                              </p>
                            )}
                            {lead.status === "Perdido" && lead.motivo_perda && (
                              <p className="text-sm text-chart-danger/80 line-clamp-2 mt-1 pt-1 border-t border-danger-soft-border">
                                Motivo: {lead.motivo_perda}
                              </p>
                            )}
                            {canEdit && (
                              <div className="flex justify-end pt-2 mt-1 border-t" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1 text-muted-foreground"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                      Ações
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>
                                        <ArrowRight className="h-3.5 w-3.5 mr-2" /> Mover para
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent>
                                        {Object.keys(statusConfig)
                                          .filter((s) => s !== lead.status)
                                          .map((s) => (
                                            <DropdownMenuItem
                                              key={s}
                                              onClick={() => {
                                                if (s === "Perdido") {
                                                  setPendingDrop({ leadId: lead.id, newStatus: s });
                                                } else if (s === "Ganho") {
                                                  setPendingDrop({ leadId: lead.id, newStatus: s });
                                                } else {
                                                  updateStatus.mutate({ leadId: lead.id, newStatus: s });
                                                }
                                              }}
                                            >
                                              {statusConfig[s].label}
                                            </DropdownMenuItem>
                                          ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      )}

      <LeadDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        lead={selectedLead}
        canEdit={canEdit}
        members={members}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onCreateProposta={() => setIsCreatePropostaOpen(true)}
        onConvert={() => setIsConvertOpen(true)}
        createPropostaPending={createProposta.isPending}
      />

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
                    placeholder="Primeiro nome"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sobrenome" className="text-xs">
                    Sobrenome
                  </Label>
                  <Input
                    id="edit-sobrenome"
                    value={editFormData.sobrenome}
                    onChange={(e) => setEditFormData({ ...editFormData, sobrenome: e.target.value })}
                    placeholder="Sobrenome"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-empresa_lead" className="text-xs">
                    Empresa
                  </Label>
                  <Input
                    id="edit-empresa_lead"
                    value={editFormData.empresa_lead}
                    onChange={(e) => setEditFormData({ ...editFormData, empresa_lead: e.target.value })}
                    placeholder="Nome da empresa"
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
                  <Label htmlFor="edit-valor_estimado" className="text-xs">
                    Valor Estimado
                  </Label>
                  <Input
                    id="edit-valor_estimado"
                    value={editFormData.valor_estimado}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, valor_estimado: formatCurrencyInput(e.target.value) })
                    }
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-previsao_fechamento" className="text-xs">
                    Previsão de Fechamento
                  </Label>
                  <DatePicker
                    id="edit-previsao_fechamento"
                    value={editFormData.previsao_fechamento}
                    onChange={(v) => setEditFormData({ ...editFormData, previsao_fechamento: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-responsavel_id" className="text-xs">
                    Responsável
                  </Label>
                  <Select
                    value={editFormData.responsavel_id}
                    onValueChange={(v) => setEditFormData({ ...editFormData, responsavel_id: v })}
                  >
                    <SelectTrigger id="edit-responsavel_id">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <div className="space-y-1.5">
                <Label htmlFor="edit-notas" className="text-xs">
                  Notas
                </Label>
                <Textarea
                  id="edit-notas"
                  value={editFormData.notas}
                  onChange={(e) => setEditFormData({ ...editFormData, notas: e.target.value })}
                  placeholder="Observações internas sobre o lead..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 bg-muted/30">
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
              <AlertTriangle className="h-5 w-5 text-chart-danger" />
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
              Deseja criar uma proposta para{" "}
              <span className="font-medium text-foreground">{selectedLead ? leadNome(selectedLead) : ""}</span>? Você
              será redirecionado para o editor de propostas.
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

      <ConfirmDialog
        open={!!leadToDelete}
        onOpenChange={(open) => !open && setLeadToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Lead"
        itemName={leadToDelete?.nome}
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}
