import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Plus, TrendingUp, Search, AlertCircle, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { parseCurrencyString, formatCurrency } from "@/lib/currencyUtils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { CollapsibleKpiSection } from "@/components/CollapsibleKpiSection";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useRegistrarPagina } from "@/hooks/useRecentes";
import { LeadsKPIs } from "./LeadsKPIs";
import { LeadDetailDialog } from "./components/LeadDetailDialog";
import { LeadFormDialog, EMPTY_LEAD_FORM, type LeadFormData } from "./components/LeadFormDialog";
import { LeadKanbanCard } from "./components/LeadKanbanCard";
import { LeadsMobile } from "./components/LeadsMobile";
import { ListaLeads } from "./components/ListaLeads";
import { LeadMotivoPerdasDialog, LeadCreatePropostaDialog } from "./components/LeadActionDialogs";
import { LeadCnpjConvertDialog, type ConvertEnrichment } from "./components/LeadCnpjConvertDialog";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useLeadEtapas, type LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";
import { useEtapasDoFunil } from "@/pages/leads/hooks/useEtapasDoFunil";
import { KanbanSkeleton } from "./components/KanbanSkeleton";
import { EtapaColapsada } from "./components/EtapaColapsada";
import { EtapaMenu } from "./components/EtapaMenu";
import { EtapaDialogs } from "./components/EtapaDialogs";
import { NovaEtapaInline } from "./components/NovaEtapaInline";
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
import { usePropostas, useConverterProposta } from "@/hooks/usePropostas";
import { propostaPrimaria, propostasPorLead } from "@/pages/leads/lib/comercial";
import {
  acaoDoDrop,
  agruparPorEtapa,
  corDaEtapaLead,
  etapaDoLead,
  primeiraEtapaDoBucket,
} from "@/pages/leads/lib/etapas";

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

export default function Leads() {
  usePageTitle("Leads");
  useRegistrarPagina("pagina", "/leads", "Leads");
  const { data: leads = [], isLoading, isError, refetch } = useLeads();
  const { data: etapas = [], isLoading: etapasLoading, isError: etapasError, refetch: refetchEtapas } = useLeadEtapas();
  const { data: propostas = [] } = usePropostas();
  const createLead = useCreateLead();
  const updateStatus = useUpdateLeadStatus();
  const convertToClient = useConvertLeadToClient();
  const converterProposta = useConverterProposta();
  const deleteLead = useDeleteLead();
  const createProposta = useCreatePropostaFromLead();
  const updateLead = useUpdateLead();
  const { data: members = [] } = useLeadMembers();
  const { canEdit } = useFeatureAccess("leads");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: "quadro" | "lista" = searchParams.get("v") === "lista" ? "lista" : "quadro";
  const setViewMode = (v: "quadro" | "lista") => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === "lista") next.set("v", "lista");
        else next.delete("v");
        return next;
      },
      { replace: true }
    );
  };

  // Casa cada lead com suas propostas (só as ligadas a lead; recompra sem lead
  // fica em /documentos nesta v1). A primária enriquece card, KPI e detalhe.
  const propostasByLead = useMemo(() => propostasPorLead(propostas), [propostas]);
  const primariaDoLead = (leadId: string) => propostaPrimaria(propostasByLead.get(leadId) ?? []);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  // Lead em edição, separado do selectedLead (detalhe): o "Editar" do menu do
  // card abre o formulário sem passar pelo detalhe.
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState<LeadFormData>(EMPTY_LEAD_FORM);
  const [editFormData, setEditFormData] = useState<LeadFormData>(EMPTY_LEAD_FORM);
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; etapa: LeadEtapa } | null>(null);
  const [isMotivoPerdasOpen, setIsMotivoPerdasOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [isAutoConvertOpen, setIsAutoConvertOpen] = useState(false);
  const [isCreatePropostaOpen, setIsCreatePropostaOpen] = useState(false);
  const [isConvertProjetoOpen, setIsConvertProjetoOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [origemFilter, setOrigemFilter] = useState("");
  const [responsavelFilter, setResponsavelFilter] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoFilter>("todos");
  const [sortBy, setSortBy] = useState<SortBy>("padrao");

  const leadNome = (lead: Lead) => (lead.sobrenome ? `${lead.nome} ${lead.sobrenome}` : lead.nome);

  const responsavelNome = (id?: string | null) => {
    if (!id) return null;
    const m = members.find((mem) => mem.id === id);
    return m ? `${m.first_name} ${m.last_name}`.trim() : null;
  };

  const toggleColumn = (etapaId: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(etapaId)) next.delete(etapaId);
      else next.add(etapaId);
      return next;
    });
  };

  const origemOptions = Array.from(
    new Set(leads.map((l) => l.origem).filter((o): o is string => !!o && o.trim() !== ""))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

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

  const matchesFilters = (lead: Lead) => {
    const q = searchQuery.trim().toLowerCase();
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
  };

  const leadsPorEtapa = agruparPorEtapa(leads.filter(matchesFilters), etapas);
  const getLeadsByEtapa = (etapaId: string) => sortLeads(leadsPorEtapa.get(etapaId) ?? []);

  const getAllFilteredLeads = () => sortLeads(leads.filter(matchesFilters));

  const etapaDe = (lead: Lead) => {
    const e = etapaDoLead(lead, etapas);
    return e ? { nome: e.nome, cor: corDaEtapaLead(e.cor, e.bucket) } : null;
  };

  const filtersActive =
    !!searchQuery.trim() || !!origemFilter || !!responsavelFilter || periodo !== "todos" || sortBy !== "padrao";

  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleSubmit = () => {
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

  const handleEditSubmit = () => {
    if (!editingLead) {
      toast.error("Não foi possível salvar", { description: "Feche o formulário e abra o lead de novo." });
      return;
    }
    if (editFormData.email) {
      const emailLower = editFormData.email.toLowerCase();
      const duplicate = leads.find((l) => (l.email ?? "").toLowerCase() === emailLower && l.id !== editingLead.id);
      if (duplicate) {
        toast.error("Email duplicado", { description: "Já existe um lead com este email." });
        return;
      }
    }
    const payload = {
      nome: editFormData.nome,
      sobrenome: editFormData.sobrenome || null,
      email: editFormData.email,
      contato: editFormData.contato,
      origem: editFormData.origem,
      // Vazio fica de fora (não null): quem não vê valores recebe o campo em
      // branco (leads_safe) e não pode apagar o valor real ao salvar.
      valor_estimado: editFormData.valor_estimado ? parseCurrencyString(editFormData.valor_estimado) : undefined,
      empresa_lead: editFormData.empresa_lead || null,
      cnpj: editFormData.cnpj || null,
      previsao_fechamento: editFormData.previsao_fechamento || null,
      responsavel_id: editFormData.responsavel_id || null,
      notas: editFormData.notas || null,
    };
    const leadId = editingLead.id;
    updateLead.mutate(
      { id: leadId, data: payload },
      {
        onSuccess: () => {
          setSelectedLead((prev) => (prev?.id === leadId ? ({ ...prev, ...payload } as Lead) : prev));
          setEditingLead(null);
          setIsEditOpen(false);
        },
      }
    );
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditingLead(lead);
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

  // Mover pelo quadro ou pelo menu do card: o bucket da coluna decide o fluxo
  // (Perdido pede o motivo, Ganho abre a conversão em cliente).
  const moverLead = (leadId: string, destino: LeadEtapa) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const acao = acaoDoDrop(destino, lead);
    if (acao === "motivo-perda") {
      setPendingDrop({ leadId, etapa: destino });
      setMotivoPerda("");
      setIsMotivoPerdasOpen(true);
      return;
    }
    if (acao === "converter") {
      setPendingDrop({ leadId, etapa: destino });
      setIsAutoConvertOpen(true);
      return;
    }
    updateStatus.mutate({ leadId, etapa: destino });
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    const destino = etapas.find((e) => e.id === destination.droppableId);
    if (!destino) return;
    moverLead(draggableId, destino);
  };

  const handleConfirmMotivoPerdas = () => {
    if (!pendingDrop || !motivoPerda.trim()) {
      toast.error("Motivo obrigatório", { description: "Informe o motivo da perda do lead." });
      return;
    }
    updateStatus.mutate(
      { leadId: pendingDrop.leadId, etapa: pendingDrop.etapa, extraFields: { motivo_perda: motivoPerda.trim() } },
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
      { leadId: pendingDrop.leadId, enrichment, etapaId: pendingDrop.etapa.id },
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
      { leadId: pendingDrop.leadId, etapa: pendingDrop.etapa },
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
    // Mantém a coluna de Ganho em que o lead já está; senão a primeira de Ganho.
    const atual = etapaDoLead(selectedLead, etapas);
    const destino = atual?.bucket === "Ganho" ? atual : primeiraEtapaDoBucket(etapas, "Ganho");
    if (!destino) {
      toast.error("Funil sem coluna de Ganho", {
        description: "Crie uma coluna que conta como Ganho e tente de novo.",
      });
      return;
    }
    setPendingDrop({ leadId: selectedLead.id, etapa: destino });
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
        navigate(`/gestao/propostas?edit=${proposta.id}`);
      },
    });
  };

  // Converter em projeto é uma ação explícita (nunca efeito de arrastar): usa a
  // proposta primária do lead e a RPC que cria cliente + projeto + disciplinas.
  const handleConfirmConvertProjeto = () => {
    if (!selectedLead) return;
    const primaria = primariaDoLead(selectedLead.id);
    if (!primaria) {
      toast.error("Sem proposta", { description: "Este lead não tem uma proposta para converter." });
      return;
    }
    converterProposta.mutate(primaria.id, {
      onSuccess: (projetoId) => {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        setIsConvertProjetoOpen(false);
        setIsDetailOpen(false);
        toast.success("Projeto criado", { description: "Projeto gerado a partir da proposta." });
        navigate(`/projetos/${projetoId}`);
      },
      onError: (err: unknown) => {
        toast.error("Erro ao converter", {
          description: err instanceof Error ? err.message : "Não foi possível criar o projeto.",
        });
      },
    });
  };

  // Colunas do funil editáveis como nos outros quadros (SPEC 120).
  const gestao = useEtapasDoFunil(etapas, (etapaId) => leadsPorEtapa.get(etapaId)?.length ?? 0);

  const hasNoLeads = leads.length === 0;
  const visibleCount = etapas.reduce((sum, e) => sum + getLeadsByEtapa(e.id).length, 0);
  const hasNoResults = !hasNoLeads && visibleCount === 0;

  const handleClearFilters = () => {
    setSearchQuery("");
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
      <CollapsibleKpiSection
        storageKey="leads"
        controls={
          <>
            <div className="hidden md:inline-flex rounded-full border p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("quadro")}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  viewMode === "quadro" ? "bg-brand text-ink" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Quadro
              </button>
              <button
                type="button"
                onClick={() => setViewMode("lista")}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  viewMode === "lista" ? "bg-brand text-ink" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Lista
              </button>
            </div>

            {/* Busca de texto migrou para o PageHeader (spec 002). */}
            <Select value={origemFilter || "todas"} onValueChange={(v) => setOrigemFilter(v === "todas" ? "" : v)}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-full text-sm" aria-label="Filtrar por origem">
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
              <SelectTrigger
                className="h-9 w-auto min-w-[150px] rounded-full text-sm"
                aria-label="Filtrar por responsável"
              >
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
              <SelectTrigger
                className="h-9 w-auto min-w-[150px] rounded-full text-sm"
                aria-label="Filtrar por previsão de fechamento"
              >
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
              <SelectTrigger className="h-9 w-auto min-w-[150px] rounded-full text-sm" aria-label="Ordenar leads">
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
          </>
        }
      >
        <LeadsKPIs
          leads={leads}
          propostasByLead={propostasByLead}
          onFilterProximos={() => setPeriodo((p) => (p === "prox7" ? "todos" : "prox7"))}
          proximosAtivo={periodo === "prox7"}
        />
      </CollapsibleKpiSection>

      {isLoading || etapasLoading ? (
        <KanbanSkeleton />
      ) : isError || etapasError || etapas.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={AlertCircle}
            title="Não foi possível carregar os leads"
            description="Verifique sua conexão e tente novamente."
            action={{
              label: "Tentar de novo",
              onClick: () => {
                refetch();
                refetchEtapas();
              },
              variant: "outline",
            }}
          />
        </div>
      ) : hasNoLeads ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={TrendingUp}
            title="Nenhum lead cadastrado"
            description="Comece capturando seu primeiro lead para acompanhar oportunidades no pipeline."
            action={canEdit ? { label: "Criar primeiro lead", onClick: () => setIsDialogOpen(true) } : undefined}
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
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-visible">
            {/* Desktop: lista (toggle) ou kanban */}
            {viewMode === "lista" ? (
              <ListaLeads
                leads={getAllFilteredLeads()}
                leadNome={leadNome}
                responsavelNome={responsavelNome}
                primariaDoLead={primariaDoLead}
                etapaDe={etapaDe}
                onRowClick={handleCardClick}
              />
            ) : (
              <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
                {etapas.map((etapa, idx) => {
                  const items = getLeadsByEtapa(etapa.id);
                  const isCollapsed = collapsedColumns.has(etapa.id);
                  const dotColor = corDaEtapaLead(etapa.cor, etapa.bucket);

                  if (isCollapsed) {
                    return (
                      <EtapaColapsada
                        key={etapa.id}
                        nome={etapa.nome}
                        cor={dotColor}
                        total={items.length}
                        onExpandir={() => toggleColumn(etapa.id)}
                      />
                    );
                  }

                  return (
                    <div key={etapa.id} className="flex flex-col min-w-[280px] w-[280px] shrink-0 min-h-0">
                      <div className="flex items-center gap-2 px-2 py-2.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                        <h3 className="text-xs font-medium text-foreground/80 uppercase tracking-wide truncate">
                          {etapa.nome}
                        </h3>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
                        <div className="ml-auto flex items-center">
                          {canEdit && (
                            <EtapaMenu
                              primeira={idx === 0}
                              ultima={idx >= etapas.length - 1}
                              onEditar={() =>
                                gestao.setEditandoEtapa({
                                  id: etapa.id,
                                  nome: etapa.nome,
                                  cor: corDaEtapaLead(etapa.cor, etapa.bucket),
                                })
                              }
                              onMover={(dir) => gestao.reordenarEtapa(etapa.id, dir)}
                              onExcluir={() => gestao.pedirExcluirEtapa(etapa)}
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-muted-foreground"
                            onClick={() => toggleColumn(etapa.id)}
                            title="Minimizar coluna"
                            aria-label="Minimizar coluna"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Droppable droppableId={etapa.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-lg bg-muted transition-all",
                              snapshot.isDraggingOver && "ring-2 ring-brand/40 bg-brand/5"
                            )}
                          >
                            {items.length === 0 && !snapshot.isDraggingOver && (
                              <div className="flex items-center justify-center py-8 px-2 text-center text-[11px] text-muted-foreground border border-dashed border-muted-foreground/20 rounded-md">
                                Arraste leads para cá
                              </div>
                            )}
                            {items.map((lead, index) => (
                              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    // O card tem botões dentro; "button" aninharia controles.
                                    // O arraste por teclado (espaço) segue no mesmo elemento.
                                    role="group"
                                    aria-roledescription="cartão arrastável"
                                  >
                                    <LeadKanbanCard
                                      lead={lead}
                                      leadNome={leadNome}
                                      onClick={() => handleCardClick(lead)}
                                      canEdit={canEdit}
                                      onEdit={handleOpenEdit}
                                      onDelete={handleDelete}
                                      dragging={snapshot.isDragging}
                                      proposta={primariaDoLead(lead.id)}
                                      responsavelNome={responsavelNome(lead.responsavel_id)}
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

                {canEdit && <NovaEtapaInline busy={gestao.criando} onCreate={gestao.criarEtapa} />}
              </div>
            )}

            {/* Mobile list view (accordion por etapa, independe do toggle Quadro/Lista) */}
            <LeadsMobile
              etapas={etapas}
              leadsDaEtapa={getLeadsByEtapa}
              leadNome={leadNome}
              canEdit={canEdit}
              proposta={primariaDoLead}
              responsavelNome={responsavelNome}
              onAbrir={handleCardClick}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onMover={moverLead}
            />
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
        etapaNome={selectedLead ? etapaDoLead(selectedLead, etapas)?.nome : undefined}
        canEdit={canEdit}
        members={members}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onCreateProposta={() => setIsCreatePropostaOpen(true)}
        onConvert={handleOpenConvert}
        createPropostaPending={createProposta.isPending}
        proposta={selectedLead ? primariaDoLead(selectedLead.id) : null}
        onOpenProposta={(id) => {
          setIsDetailOpen(false);
          navigate(`/gestao/propostas?edit=${id}`);
        }}
        onConvertProjeto={() => setIsConvertProjetoOpen(true)}
        convertProjetoPending={converterProposta.isPending}
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
        title="Excluir lead"
        itemName={leadToDelete?.nome}
        description="O lead sai do pipeline. Você pode desfazer logo após excluir."
        confirmText="Excluir"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        open={isConvertProjetoOpen}
        onOpenChange={setIsConvertProjetoOpen}
        onConfirm={handleConfirmConvertProjeto}
        title="Converter em projeto"
        description="Cria o projeto a partir da proposta, promove o lead a cliente e copia as disciplinas. Não dá para desfazer."
        confirmText="Converter"
        cancelText="Cancelar"
      />

      <EtapaDialogs
        editando={gestao.editandoEtapa}
        onFecharEdicao={() => gestao.setEditandoEtapa(null)}
        onSalvar={gestao.salvarEtapa}
        salvando={gestao.salvando}
        aExcluir={gestao.aEtapaExcluir}
        onFecharExclusao={() => gestao.setAEtapaExcluir(null)}
        onExcluir={gestao.confirmarExcluirEtapa}
        excluindo={gestao.excluindo}
      />
    </PageLayout>
  );
}
