import { useState } from "react";
import { statusBadgeClasses, statusLabel } from "@/lib/status";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, TrendingUp, Search, AlertCircle, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { parseCurrencyString, formatCurrency } from "@/lib/currencyUtils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useRegistrarPagina } from "@/hooks/useRecentes";
import { LeadsKPIs } from "./LeadsKPIs";
import { LeadDetailDialog } from "./components/LeadDetailDialog";
import { LeadFormDialog, EMPTY_LEAD_FORM, type LeadFormData } from "./components/LeadFormDialog";
import { LeadKanbanCard } from "./components/LeadKanbanCard";
import { LeadMotivoPerdasDialog, LeadCreatePropostaDialog } from "./components/LeadActionDialogs";
import { LeadCnpjConvertDialog, type ConvertEnrichment } from "./components/LeadCnpjConvertDialog";
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

// Cores derivam do registry único (ADR 0008): mudar tom = src/lib/status.ts.
const leadStatus = (s: string) => ({ label: statusLabel("lead", s), color: statusBadgeClasses("lead", s) });

const statusConfig: Record<string, { label: string; color: string }> = {
  Novo: leadStatus("Novo"),
  "Em contato": leadStatus("Em contato"),
  Proposta: leadStatus("Proposta"),
  Negociação: leadStatus("Negociação"),
  Ganho: leadStatus("Ganho"),
  Perdido: leadStatus("Perdido"),
};

const STATUS_DOT: Record<string, string> = {
  Novo: "bg-pipeline-novo",
  "Em contato": "bg-pipeline-contato",
  Proposta: "bg-pipeline-negociacao",
  Negociação: "bg-brand",
  Ganho: "bg-status-done",
  Perdido: "bg-status-cancelled",
};

type PeriodoFilter = "todos" | "prox7" | "atrasados" | "mes";
type SortBy = "padrao" | "valor_desc" | "valor_asc" | "previsao_asc" | "previsao_desc";

const PERIODO_OPTIONS: { value: PeriodoFilter; label: string }[] = [
  { value: "todos", label: "Qualquer previsão" },
  { value: "prox7", label: "Fecham em 7 dias" },
  { value: "atrasados", label: "Previsão vencida" },
  { value: "mes", label: "Fecham este mês" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "padrao", label: "Mais recentes" },
  { value: "valor_desc", label: "Maior valor" },
  { value: "valor_asc", label: "Menor valor" },
  { value: "previsao_asc", label: "Previsão mais próxima" },
  { value: "previsao_desc", label: "Previsão mais distante" },
];

const SEM_RESPONSAVEL = "__sem__";

function KanbanSkeleton() {
  const columns = Object.values(statusConfig);
  return (
    <div className="flex-1 min-h-0" aria-hidden="true">
      <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
        {columns.map((config, colIndex) => (
          <div key={config.label} className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 min-h-0">
            <div className="flex items-center gap-2 px-2 py-2.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex-1 min-h-0 p-2 space-y-2 rounded-lg bg-muted/30">
              {Array.from({ length: colIndex % 2 === 0 ? 3 : 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="md:hidden space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function Leads() {
  usePageTitle("Leads");
  useRegistrarPagina("pagina", "/leads", "Leads");
  const { data: leads = [], isLoading, isError, refetch } = useLeads();
  const createLead = useCreateLead();
  const updateStatus = useUpdateLeadStatus();
  const convertToClient = useConvertLeadToClient();
  const deleteLead = useDeleteLead();
  const createProposta = useCreatePropostaFromLead();
  const updateLead = useUpdateLead();
  const { data: members = [] } = useLeadMembers();
  const { canEdit } = useFeatureAccess("leads");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>(EMPTY_LEAD_FORM);
  const [editFormData, setEditFormData] = useState<LeadFormData>(EMPTY_LEAD_FORM);
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; newStatus: Lead["status"] } | null>(null);
  const [isMotivoPerdasOpen, setIsMotivoPerdasOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [isAutoConvertOpen, setIsAutoConvertOpen] = useState(false);
  const [isCreatePropostaOpen, setIsCreatePropostaOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [estagioFilter, setEstagioFilter] = useState<Set<string>>(new Set());
  const [origemFilter, setOrigemFilter] = useState("");
  const [responsavelFilter, setResponsavelFilter] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoFilter>("todos");
  const [sortBy, setSortBy] = useState<SortBy>("padrao");

  const leadNome = (lead: Lead) => (lead.sobrenome ? `${lead.nome} ${lead.sobrenome}` : lead.nome);

  const toggleColumn = (status: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const origemOptions = Array.from(
    new Set(leads.map((l) => l.origem).filter((o): o is string => !!o && o.trim() !== ""))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const toggleEstagio = (status: string) => {
    setEstagioFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const matchesPeriodo = (lead: Lead) => {
    if (periodo === "todos") return true;
    if (!lead.previsao_fechamento) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(lead.previsao_fechamento + "T00:00:00");
    if (periodo === "prox7") {
      const in7 = new Date(today);
      in7.setDate(in7.getDate() + 7);
      return d >= today && d <= in7;
    }
    if (periodo === "atrasados") return d < today;
    // "mes": mesmo mês/ano do dia atual.
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  };

  const sortLeads = (items: Lead[]) => {
    if (sortBy === "padrao") return items;
    const arr = [...items];
    const prev = (l: Lead) => (l.previsao_fechamento ? new Date(l.previsao_fechamento + "T00:00:00").getTime() : null);
    if (sortBy === "valor_desc") return arr.sort((a, b) => (b.valor_estimado ?? 0) - (a.valor_estimado ?? 0));
    if (sortBy === "valor_asc") return arr.sort((a, b) => (a.valor_estimado ?? 0) - (b.valor_estimado ?? 0));
    // Ordenação por previsão: leads sem data vão para o fim em ambas as direções.
    const dir = sortBy === "previsao_asc" ? 1 : -1;
    return arr.sort((a, b) => {
      const da = prev(a);
      const db = prev(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return (da - db) * dir;
    });
  };

  const getLeadsByStatus = (status: string) => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      if (lead.status !== status) return false;
      if (origemFilter && (lead.origem ?? "") !== origemFilter) return false;
      if (responsavelFilter) {
        if (responsavelFilter === SEM_RESPONSAVEL) {
          if (lead.responsavel_id) return false;
        } else if (lead.responsavel_id !== responsavelFilter) {
          return false;
        }
      }
      if (!matchesPeriodo(lead)) return false;
      if (!q) return true;
      const fullName = leadNome(lead).toLowerCase();
      return (
        fullName.includes(q) ||
        (lead.empresa_lead ?? "").toLowerCase().includes(q) ||
        (lead.email ?? "").toLowerCase().includes(q)
      );
    });
    return sortLeads(filtered);
  };

  const visibleStatuses = Object.keys(statusConfig).filter((s) => estagioFilter.size === 0 || estagioFilter.has(s));

  const filtersActive =
    !!searchQuery.trim() ||
    estagioFilter.size > 0 ||
    !!origemFilter ||
    !!responsavelFilter ||
    periodo !== "todos" ||
    sortBy !== "padrao";

  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.email) {
      const emailLower = formData.email.toLowerCase();
      const duplicate = leads.find((l) => (l.email ?? "").toLowerCase() === emailLower);
      if (duplicate) {
        toast.error("Email duplicado", { description: "Já existe um lead com este email." });
        return;
      }
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
        cnpj: formData.cnpj || undefined,
        previsao_fechamento: formData.previsao_fechamento || undefined,
        responsavel_id: formData.responsavel_id || undefined,
        notas: formData.notas || undefined,
      },
      {
        onSuccess: () => {
          setFormData(EMPTY_LEAD_FORM);
          setIsDialogOpen(false);
        },
      }
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    if (editFormData.email) {
      const emailLower = editFormData.email.toLowerCase();
      const duplicate = leads.find((l) => (l.email ?? "").toLowerCase() === emailLower && l.id !== selectedLead.id);
      if (duplicate) {
        toast.error("Email duplicado", { description: "Já existe um lead com este email." });
        return;
      }
    }
    const payload = {
      nome: editFormData.nome,
      sobrenome: editFormData.sobrenome || undefined,
      email: editFormData.email,
      contato: editFormData.contato,
      origem: editFormData.origem,
      valor_estimado: editFormData.valor_estimado ? parseCurrencyString(editFormData.valor_estimado) : undefined,
      empresa_lead: editFormData.empresa_lead || undefined,
      cnpj: editFormData.cnpj || undefined,
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

  const handleOpenEdit = (lead: Lead) => {
    setEditFormData({
      nome: lead.nome,
      sobrenome: lead.sobrenome ?? "",
      email: lead.email ?? "",
      contato: lead.contato ?? "",
      origem: lead.origem ?? "",
      valor_estimado: lead.valor_estimado ? formatCurrency(lead.valor_estimado) : "",
      empresa_lead: lead.empresa_lead ?? "",
      cnpj: lead.cnpj ?? "",
      previsao_fechamento: lead.previsao_fechamento ?? "",
      responsavel_id: lead.responsavel_id ?? "",
      notas: lead.notas ?? "",
    });
    setIsEditOpen(true);
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    const newStatus = destination.droppableId as Lead["status"];

    if (newStatus === "Perdido") {
      setPendingDrop({ leadId: draggableId, newStatus });
      setMotivoPerda("");
      setIsMotivoPerdasOpen(true);
      return;
    }
    if (newStatus === "Ganho") {
      const lead = leads.find((l) => l.id === draggableId);
      if (lead && !lead.cliente_id) {
        setPendingDrop({ leadId: draggableId, newStatus });
        setIsAutoConvertOpen(true);
        return;
      }
    }
    updateStatus.mutate({ leadId: draggableId, newStatus });
  };

  const handleMobileMove = (leadId: string, newStatus: Lead["status"]) => {
    if (newStatus === "Perdido") {
      setPendingDrop({ leadId, newStatus });
      setMotivoPerda("");
      setIsMotivoPerdasOpen(true);
    } else if (newStatus === "Ganho") {
      const lead = leads.find((l) => l.id === leadId);
      setPendingDrop({ leadId, newStatus });
      if (lead && !lead.cliente_id) {
        setIsAutoConvertOpen(true);
      } else {
        updateStatus.mutate({ leadId, newStatus });
        setPendingDrop(null);
      }
    } else {
      updateStatus.mutate({ leadId, newStatus });
    }
  };

  const handleConfirmMotivoPerdas = () => {
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

  const handleAutoConvert = (enrichment: ConvertEnrichment | null) => {
    if (!pendingDrop) return;
    convertToClient.mutate(
      { leadId: pendingDrop.leadId, enrichment },
      {
        onSuccess: () => {
          setIsAutoConvertOpen(false);
          setPendingDrop(null);
          setIsDetailOpen(false);
        },
      }
    );
  };

  const handleSkipConvert = () => {
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

  // Conversão a partir do detalhe usa o mesmo fluxo do arrastar para "Ganho"
  // (dialog de CNPJ com enriquecimento), em vez de um caminho separado sem CNPJ.
  const handleOpenConvert = () => {
    if (!selectedLead) return;
    if (selectedLead.cliente_id) {
      toast.error("Já convertido", { description: "Este lead já foi convertido em cliente." });
      return;
    }
    setPendingDrop({ leadId: selectedLead.id, newStatus: "Ganho" });
    setIsAutoConvertOpen(true);
  };

  const handleDelete = (id: string) => {
    const lead = leads.find((l) => l.id === id);
    setLeadToDelete({ id, nome: lead ? leadNome(lead) : "Lead" });
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

  const handleCriarProposta = (lead: Lead) => {
    createProposta.mutate(lead, {
      onSuccess: (proposta) => {
        setIsDetailOpen(false);
        navigate(`/documentos?edit=${proposta.id}`);
      },
    });
  };

  const hasNoLeads = leads.length === 0;
  const visibleCount = Object.keys(statusConfig).reduce((sum, s) => sum + getLeadsByStatus(s).length, 0);
  const hasNoResults = !hasNoLeads && visibleCount === 0;

  const handleClearFilters = () => {
    setSearchQuery("");
    setEstagioFilter(new Set());
    setOrigemFilter("");
    setResponsavelFilter("");
    setPeriodo("todos");
    setSortBy("padrao");
  };

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Leads"
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Buscar por nome, empresa ou email" }}
          primaryAction={{ label: "Novo lead", onClick: () => setIsDialogOpen(true), icon: Plus, feature: "leads" }}
        />
      }
    >
      <LeadsKPIs
        leads={leads}
        onFilterProximos={() => setPeriodo((p) => (p === "prox7" ? "todos" : "prox7"))}
        proximosAtivo={periodo === "prox7"}
      />

      <div className="flex flex-col gap-2 mb-2 mt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca de texto migrou para o PageHeader (spec 002). */}
          <Select value={origemFilter || "todas"} onValueChange={(v) => setOrigemFilter(v === "todas" ? "" : v)}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] text-sm" aria-label="Filtrar por origem">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              {origemOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={responsavelFilter || "todos"}
            onValueChange={(v) => setResponsavelFilter(v === "todos" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-auto min-w-[150px] text-sm" aria-label="Filtrar por responsável">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFilter)}>
            <SelectTrigger className="h-9 w-auto min-w-[150px] text-sm" aria-label="Filtrar por previsão de fechamento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="h-9 w-auto min-w-[150px] text-sm" aria-label="Ordenar leads">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 text-sm text-muted-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Estágio</span>
          {Object.entries(statusConfig).map(([status, config]) => {
            const active = estagioFilter.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleEstagio(status)}
                aria-pressed={active}
                className={cn(
                  "text-xs rounded-full border px-2.5 py-1 transition-colors",
                  active
                    ? "border-brand bg-brand text-ink font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <KanbanSkeleton />
      ) : isError ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={AlertCircle}
            title="Não foi possível carregar os leads"
            description="Verifique sua conexão e tente novamente."
            action={{ label: "Tentar de novo", onClick: () => refetch(), variant: "outline" }}
          />
        </div>
      ) : hasNoLeads ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={TrendingUp}
            title="Nenhum lead cadastrado"
            description="Comece capturando seu primeiro lead para acompanhar oportunidades no pipeline."
            action={canEdit ? { label: "Criar Primeiro Lead", onClick: () => setIsDialogOpen(true) } : undefined}
          />
        </div>
      ) : hasNoResults ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={Search}
            title="Nenhum resultado para esses filtros"
            description="Tente ajustar ou limpar os filtros aplicados para ver seus leads."
            action={{ label: "Limpar filtros", onClick: handleClearFilters, variant: "outline" }}
          />
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 min-h-0">
            {/* Desktop kanban */}
            <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
              {visibleStatuses.map((status) => {
                const config = statusConfig[status];
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
                    <div className="flex items-center gap-2 px-2 py-2.5">
                      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
                      <h3 className="text-xs font-medium text-foreground/80 uppercase tracking-wide">{config.label}</h3>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto min-h-[44px] min-w-[44px] text-muted-foreground"
                        onClick={() => toggleColumn(status)}
                        title="Minimizar coluna"
                        aria-label="Minimizar coluna"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
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
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                  <LeadKanbanCard
                                    lead={lead}
                                    leadNome={leadNome}
                                    onClick={() => handleCardClick(lead)}
                                    canEdit={canEdit}
                                    onMoveStatus={handleMobileMove}
                                    dragging={snapshot.isDragging}
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
                );
              })}
            </div>

            {/* Mobile list view */}
            <div className="md:hidden space-y-3">
              {visibleStatuses.map((status) => {
                const config = statusConfig[status];
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
                        <LeadKanbanCard
                          key={lead.id}
                          lead={lead}
                          leadNome={leadNome}
                          onClick={() => handleCardClick(lead)}
                          canEdit={canEdit}
                          onMoveStatus={handleMobileMove}
                        />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Dialogs */}
      <LeadFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        mode="create"
        formData={formData}
        onFormChange={setFormData}
        onSubmit={handleSubmit}
        isPending={createLead.isPending}
        members={members}
      />

      <LeadFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        mode="edit"
        formData={editFormData}
        onFormChange={setEditFormData}
        onSubmit={handleEditSubmit}
        isPending={updateLead.isPending}
        members={members}
      />

      <LeadDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        lead={selectedLead}
        canEdit={canEdit}
        members={members}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onCreateProposta={() => setIsCreatePropostaOpen(true)}
        onConvert={handleOpenConvert}
        createPropostaPending={createProposta.isPending}
      />

      <LeadMotivoPerdasDialog
        open={isMotivoPerdasOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDrop(null);
            setMotivoPerda("");
          }
          setIsMotivoPerdasOpen(open);
        }}
        motivoPerda={motivoPerda}
        onMotivoChange={setMotivoPerda}
        onConfirm={handleConfirmMotivoPerdas}
        onCancel={() => {
          setIsMotivoPerdasOpen(false);
          setPendingDrop(null);
        }}
      />

      <LeadCnpjConvertDialog
        open={isAutoConvertOpen}
        onOpenChange={(open) => {
          if (!open && pendingDrop) {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setPendingDrop(null);
          }
          setIsAutoConvertOpen(open);
        }}
        isPending={convertToClient.isPending}
        onConvert={handleAutoConvert}
        onSkip={handleSkipConvert}
      />

      <LeadCreatePropostaDialog
        open={isCreatePropostaOpen}
        onOpenChange={setIsCreatePropostaOpen}
        leadNome={selectedLead ? leadNome(selectedLead) : ""}
        isPending={createProposta.isPending}
        onConfirm={() => {
          setIsCreatePropostaOpen(false);
          if (selectedLead) handleCriarProposta(selectedLead);
        }}
      />

      <ConfirmDialog
        open={!!leadToDelete}
        onOpenChange={(open) => !open && setLeadToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Lead"
        itemName={leadToDelete?.nome}
        description="O lead sai do pipeline. Você pode desfazer logo após excluir."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}
