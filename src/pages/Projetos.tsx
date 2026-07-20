import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar as CalendarIcon, GitBranch, Layers, MapPin, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Can } from "@/components/Can";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import { type Projeto, getDeadlineStatus } from "@/types/projetos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProjectDetailDialog } from "@/pages/projetos/components/ProjectDetailDialog";
import { ProjetoFormDialog } from "@/pages/projetos/components/ProjetoFormDialog";
import { ManageDisciplinasDialog } from "@/pages/projetos/components/ManageDisciplinasDialog";
import { FluxoDisciplinasDialog } from "@/pages/projetos/components/FluxoDisciplinasDialog";
import { DisciplinasTab } from "@/pages/projetos/components/DisciplinasTab";
import { CronogramaProjetosTab } from "@/pages/projetos/components/CronogramaProjetosTab";
import {
  ProjetosFilterBar,
  EMPTY_FILTERS,
  type DeadlineFilter,
} from "@/pages/projetos/components/ProjetosFilterBar";
import { ProjetosKPIs } from "@/pages/projetos/components/ProjetosKPIs";
import { ProjetosEmptyState } from "@/pages/projetos/components/ProjetosEmptyState";
import { KanbanBoard } from "@/pages/projetos/components/KanbanBoard";
import { MapaTab } from "@/pages/projetos/components/MapaTab";
import { ProjetosMobileList } from "@/pages/projetos/components/ProjetosMobileList";
import { SortControl } from "@/pages/projetos/components/SortControl";
import { NotifyTeamDialog, ReopenProjetoDialog } from "@/pages/projetos/components/ProjetoStatusDialogs";
import { useProjetosData } from "@/pages/projetos/hooks/useProjetosData";
import { useProjetosUrlState } from "@/pages/projetos/hooks/useProjetosUrlState";
import { useProjetoStatusMove } from "@/pages/projetos/hooks/useProjetoStatusMove";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient } from "@tanstack/react-query";

type Tab = "kanban" | "disciplinas" | "cronograma" | "mapa";

export default function ProjetosKanban() {
  usePageTitle("Projetos");
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = can("projetos", "create");
  const canViewMapa = can("mapa", "view");
  const [searchParams] = useSearchParams();

  const {
    templatesData,
    fluxosData,
    rentabilidadeMap,
    currentUser,
    projetos,
    loadingProjetos,
    projetosError,
    refetchProjetos,
    clientes,
    pessoas,
    disciplinas,
  } = useProjetosData();

  const { filters, setFilters, sort, setSort, collapsedColumns, toggleColumn } = useProjetosUrlState();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [isDisciplinasOpen, setIsDisciplinasOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const view = searchParams.get("view");
    if (view === "mapa" && canViewMapa) return "mapa";
    if (view === "disciplinas" || view === "cronograma") return view;
    return "kanban";
  });
  const [isFluxosOpen, setIsFluxosOpen] = useState(false);
  const [projetoToDelete, setProjetoToDelete] = useState<{ id: string; nome: string } | null>(null);

  const {
    pendingDrag,
    setPendingDrag,
    pendingReopen,
    setPendingReopen,
    applyStatusMove,
    handleMoveStatus,
    onDragEnd,
    notifyProjectStatusChange,
  } = useProjetoStatusMove(projetos, canEdit);

  const handleCardClick = (projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setIsDetailOpen(true);
  };

  const handleEditClick = (projeto: Projeto) => {
    setEditingProjeto(projeto);
    setIsDetailOpen(false);
    setIsFormDialogOpen(true);
  };

  const handleNewProjeto = () => {
    setEditingProjeto(null);
    setIsFormDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const projeto = projetos.find((p) => p.id === id);
    setProjetoToDelete({ id, nome: projeto?.nome ?? "Projeto" });
  };

  const handleDeleteConfirm = async () => {
    if (!projetoToDelete) return;
    const { error } = await supabase
      .from("projetos")
      .delete()
      .eq("id", projetoToDelete.id);
    if (!error) {
      toast.success("Projeto excluído");
      setIsDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    } else {
      toast.error("Erro ao excluir", { description: error.message });
    }
    setProjetoToDelete(null);
  };

  // ---------- Filtros ----------
  const disciplinaNomesSelected = useMemo(() => {
    const map = new Map(disciplinas.map((d) => [d.id, d.nome.toLowerCase()]));
    return new Set(filters.disciplinaIds.map((id) => map.get(id)).filter(Boolean) as string[]);
  }, [disciplinas, filters.disciplinaIds]);

  const matchesFilters = (projeto: Projeto): boolean => {
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      const haystack = `${projeto.codigo_projeto} ${projeto.nome} ${projeto.cliente_nome || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.prioridades.length > 0 && !filters.prioridades.includes(projeto.prioridade as ProjectPriority)) {
      return false;
    }
    if (filters.clienteIds.length > 0 && !filters.clienteIds.includes(projeto.cliente_id)) {
      return false;
    }
    if (filters.pessoaIds.length > 0) {
      const matched = projeto.disciplinas?.some((d) => {
        if (filters.pessoaIds.includes(d.responsavel_id || "")) return true;
        if (d.responsaveis?.some((r) => filters.pessoaIds.includes(r.responsavel_id))) return true;
        return false;
      });
      if (!matched) return false;
    }
    if (disciplinaNomesSelected.size > 0) {
      const matched = projeto.disciplinas?.some((d) => disciplinaNomesSelected.has((d.disciplina || "").toLowerCase()));
      if (!matched) return false;
    }
    if (filters.deadlineStatus.length > 0) {
      const ds = getDeadlineStatus(projeto);
      const key = ds?.status_data;
      if (!key || !filters.deadlineStatus.includes(key as DeadlineFilter)) return false;
    }
    if (filters.dataInicio || filters.dataFim) {
      const val =
        filters.dataCampo === "inicio"
          ? projeto.data_inicio
          : filters.dataCampo === "final"
            ? projeto.data_final
            : projeto.data_previsao;
      // Não descarta projetos sem a data escolhida: só aplica o intervalo aos
      // que a possuem, evitando esconder projetos por falta de uma data.
      if (val) {
        if (filters.dataInicio && val < filters.dataInicio) return false;
        if (filters.dataFim && val > filters.dataFim) return false;
      }
    }
    return true;
  };

  const sortProjetos = (a: Projeto, b: Projeto): number => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.key) {
      case "priority": {
        const wa = PROJECT_PRIORITY_CONFIG[a.prioridade as ProjectPriority]?.sortWeight ?? 1;
        const wb = PROJECT_PRIORITY_CONFIG[b.prioridade as ProjectPriority]?.sortWeight ?? 1;
        return (wa - wb) * dir;
      }
      case "dueDate": {
        const da = a.data_previsao || "9999-12-31";
        const db = b.data_previsao || "9999-12-31";
        return da.localeCompare(db) * dir;
      }
      case "value":
        return ((a.valor_contrato || 0) - (b.valor_contrato || 0)) * dir;
      case "name":
        return a.nome.localeCompare(b.nome) * dir;
      case "created":
      default:
        return 0; // já vem ordenado por created_at desc do server
    }
  };

  const filteredProjetos = useMemo(
    () => projetos.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projetos, filters, disciplinaNomesSelected]
  );

  // Agrupa e ordena por status uma única vez por render, em vez de rodar
  // filter().sort() para cada coluna (12 varreduras da lista a cada render).
  const projetosByStatus = useMemo(() => {
    const groups: Record<string, Projeto[]> = {};
    for (const p of filteredProjetos) {
      (groups[p.status] ||= []).push(p);
    }
    for (const key of Object.keys(groups)) groups[key].sort(sortProjetos);
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProjetos, sort]);

  const getProjetosByStatus = (status: string) => projetosByStatus[status] || [];

  const tabs: { id: Tab; label: string; icon: typeof CalendarIcon }[] = [
    { id: "kanban", label: "Quadro", icon: CalendarIcon },
    { id: "disciplinas", label: "Disciplinas", icon: Layers },
    { id: "cronograma", label: "Cronograma", icon: CalendarIcon },
    ...(canViewMapa ? [{ id: "mapa" as Tab, label: "Mapa", icon: MapPin }] : []),
  ];

  // Navegação por teclado nas abas (padrão ARIA tablist: setas, Home/End).
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const order = tabs.map((t) => t.id);
    const idx = order.indexOf(activeTab);
    let next: Tab | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = order[(idx + 1) % order.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = order[(idx - 1 + order.length) % order.length];
    else if (e.key === "Home") next = order[0];
    else if (e.key === "End") next = order[order.length - 1];
    if (!next) return;
    e.preventDefault();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  };

  const noProjetos = !loadingProjetos && !projetosError && projetos.length === 0;
  const noResults = !loadingProjetos && !projetosError && projetos.length > 0 && filteredProjetos.length === 0;

  return (
    <PageLayout
      className={activeTab === "kanban" ? "overflow-y-hidden" : undefined}
      containerClassName={cn("flex flex-col", activeTab === "kanban" && "h-full min-h-0")}
      header={
        <PageHeader
          title="Projetos"
          description="Gerencie seus projetos"
          children={
            <div className="flex gap-2 items-center flex-wrap">
              <ProjetosFilterBar
                pessoas={pessoas}
                clientes={clientes}
                disciplinas={disciplinas}
                filters={filters}
                onChange={setFilters}
              />

              <Can feature="projetos" action="edit">
                <Button variant="outline" className="rounded-full text-sm" onClick={() => setIsDisciplinasOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Disciplinas
                </Button>
              </Can>

              <Can feature="projetos" action="edit">
                <Button variant="outline" className="rounded-full text-sm" onClick={() => setIsFluxosOpen(true)}>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Fluxos
                </Button>
              </Can>

              <Can feature="projetos" action="create">
                <Button
                  className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                  onClick={handleNewProjeto}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Projeto
                </Button>
              </Can>
            </div>
          }
        />
      }
    >
      {/* KPIs */}
      {!loadingProjetos && projetos.length > 0 && (
        <ProjetosKPIs
          projetos={projetos}
          onFilterAtraso={() => setFilters((f) => ({ ...f, deadlineStatus: ["em_atraso"] }))}
          onFilterProximos={() => {
            const today = new Date().toISOString().slice(0, 10);
            const in7 = new Date();
            in7.setDate(in7.getDate() + 7);
            setFilters((f) => ({
              ...f,
              dataInicio: today,
              dataFim: in7.toISOString().slice(0, 10),
            }));
          }}
        />
      )}

      {/* Abas. O SortControl fica nesta linha (não no header) para a altura do
          header não variar entre abas e a barra de abas não "pular". */}
      <div className="flex items-center justify-between gap-2 border-b mb-4">
      <div role="tablist" aria-label="Visualização de projetos" className="flex items-center gap-0">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[tab.id] = el)}
              role="tab"
              id={`projetos-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`projetos-tabpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                "px-4 py-2 text-sm transition-colors -mb-px rounded-t-md border border-transparent",
                selected
                  ? "bg-brand border-brand text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
        {activeTab === "kanban" && <SortControl sort={sort} onChange={setSort} />}
      </div>

      {/* Erro de carregamento: estado distinto do empty, com opção de tentar de novo */}
      {projetosError && <ProjetosEmptyState variant="error" onRetry={() => refetchProjetos()} />}

      {/* Empty states globais */}
      {!projetosError && noProjetos && activeTab === "kanban" && (
        <ProjetosEmptyState variant="no-projetos" onCreate={canEdit ? handleNewProjeto : undefined} />
      )}

      {projetosError ? null : activeTab === "kanban" && !noProjetos ? (
        <>
          {noResults ? (
            <ProjetosEmptyState variant="no-results" onClearFilters={() => setFilters(EMPTY_FILTERS)} />
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div
                role="tabpanel"
                id="projetos-tabpanel-kanban"
                aria-labelledby="projetos-tab-kanban"
                className="flex-1 min-h-0"
              >
                <KanbanBoard
                  collapsedColumns={collapsedColumns}
                  loadingProjetos={loadingProjetos}
                  canEdit={canEdit}
                  clientes={clientes}
                  rentabilidadeMap={rentabilidadeMap}
                  getProjetosByStatus={getProjetosByStatus}
                  onToggleColumn={toggleColumn}
                  onCardClick={handleCardClick}
                  onEditClick={handleEditClick}
                  onDelete={handleDelete}
                  onQuickAddCreated={() => queryClient.invalidateQueries({ queryKey: ["projetos"] })}
                />

                <ProjetosMobileList
                  canEdit={canEdit}
                  rentabilidadeMap={rentabilidadeMap}
                  getProjetosByStatus={getProjetosByStatus}
                  onCardClick={handleCardClick}
                  onEditClick={handleEditClick}
                  onDelete={handleDelete}
                  onMoveStatus={handleMoveStatus}
                />
              </div>
            </DragDropContext>
          )}
        </>
      ) : activeTab === "disciplinas" ? (
        <div role="tabpanel" id="projetos-tabpanel-disciplinas" aria-labelledby="projetos-tab-disciplinas">
          <DisciplinasTab projetos={filteredProjetos} />
        </div>
      ) : activeTab === "cronograma" ? (
        <div role="tabpanel" id="projetos-tabpanel-cronograma" aria-labelledby="projetos-tab-cronograma">
          <CronogramaProjetosTab projetos={filteredProjetos} />
        </div>
      ) : activeTab === "mapa" ? (
        <MapaTab />
      ) : null}

      <ProjectDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        projeto={selectedProjeto}
        canEdit={canEdit}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        onProjectUpdated={() => queryClient.invalidateQueries({ queryKey: ["projetos"] })}
      />

      <ProjetoFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        editProjeto={editingProjeto}
        clientes={clientes}
        pessoas={pessoas}
        disciplinas={disciplinas}
        templatesData={templatesData}
        fluxosData={fluxosData}
        currentUser={currentUser}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["projetos"] })}
      />

      <ManageDisciplinasDialog
        open={isDisciplinasOpen}
        onOpenChange={setIsDisciplinasOpen}
        disciplinas={disciplinas}
        onDisciplinasChanged={() => queryClient.invalidateQueries({ queryKey: ["disciplinas"] })}
      />

      <FluxoDisciplinasDialog
        open={isFluxosOpen}
        onOpenChange={setIsFluxosOpen}
        disciplinas={disciplinas}
        pessoas={pessoas}
      />

      <NotifyTeamDialog
        pending={pendingDrag}
        onOpenChange={(open) => !open && setPendingDrag(null)}
        onCancel={() => setPendingDrag(null)}
        onConfirm={async () => {
          if (pendingDrag) {
            await notifyProjectStatusChange(pendingDrag.projetoId, pendingDrag.newStatus);
            setPendingDrag(null);
          }
        }}
      />

      <ReopenProjetoDialog
        pending={pendingReopen}
        onOpenChange={(open) => !open && setPendingReopen(null)}
        onCancel={() => setPendingReopen(null)}
        onConfirm={async () => {
          if (!pendingReopen) return;
          const { projetoId, newStatus } = pendingReopen;
          setPendingReopen(null);
          await applyStatusMove(projetoId, newStatus, true);
        }}
      />

      <ConfirmDialog
        open={!!projetoToDelete}
        onOpenChange={(open) => !open && setProjetoToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Projeto"
        itemName={projetoToDelete?.nome}
        description="O projeto sai das listagens e o histórico é preservado. A exclusão é bloqueada se houver lançamentos financeiros vinculados."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}
