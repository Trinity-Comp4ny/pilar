import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GitBranch,
  Layers,
  Plus,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { monitoring } from "@/lib/monitoring";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Can } from "@/components/Can";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  PROJECT_STATUS,
  PROJECT_STATUS_CONFIG,
  PROJECT_PRIORITY,
  PROJECT_PRIORITY_CONFIG,
  type ProjectPriority,
  type ProjectStatus,
} from "@/constants";
import { type Projeto, type ProjetoDisciplinaDB, dbDisciplinaToLegacy, getDeadlineStatus } from "@/types/projetos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";
import { ProjectDetailDialog } from "@/pages/projetos/components/ProjectDetailDialog";
import { ProjetoFormDialog } from "@/pages/projetos/components/ProjetoFormDialog";
import { ManageDisciplinasDialog } from "@/pages/projetos/components/ManageDisciplinasDialog";
import { FluxoDisciplinasDialog } from "@/pages/projetos/components/FluxoDisciplinasDialog";
import { DisciplinasTab } from "@/pages/projetos/components/DisciplinasTab";
import { CronogramaProjetosTab } from "@/pages/projetos/components/CronogramaProjetosTab";
import {
  ProjetosFilterBar,
  EMPTY_FILTERS,
  type ProjetosFilters,
  type DeadlineFilter,
} from "@/pages/projetos/components/ProjetosFilterBar";
import { ProjetosKPIs } from "@/pages/projetos/components/ProjetosKPIs";
import { ProjetoColumnSkeleton } from "@/pages/projetos/components/ProjetoCardSkeleton";
import { ProjetosEmptyState } from "@/pages/projetos/components/ProjetosEmptyState";
import { QuickAddCard } from "@/pages/projetos/components/QuickAddCard";
import { useTemplates } from "@/hooks/useTemplates";
import { useFluxosDisciplinas } from "@/hooks/useFluxosDisciplinas";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const statusConfig = PROJECT_STATUS_CONFIG;

type Tab = "kanban" | "disciplinas" | "cronograma";
type SortKey = "priority" | "dueDate" | "value" | "name" | "created";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  priority: "Prioridade",
  dueDate: "Previsão",
  value: "Valor",
  name: "Nome",
  created: "Criação",
};

const STATUS_DOT: Record<string, string> = {
  [PROJECT_STATUS.PLANEJAMENTO]: "bg-status-planning",
  [PROJECT_STATUS.EM_ANDAMENTO]: "bg-status-progress",
  [PROJECT_STATUS.REVISAO]: "bg-status-review",
  [PROJECT_STATUS.PARALISADO]: "bg-brand",
  [PROJECT_STATUS.CONCLUIDO]: "bg-status-done",
  [PROJECT_STATUS.CANCELADO]: "bg-status-cancelled",
};

// ---------- URL persistence helpers ----------
function filtersToParams(filters: ProjetosFilters, sort: { key: SortKey; dir: SortDir }, collapsed: Set<string>) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.prioridades.length) params.set("prio", filters.prioridades.join(","));
  if (filters.pessoaIds.length) params.set("p", filters.pessoaIds.join(","));
  if (filters.clienteIds.length) params.set("c", filters.clienteIds.join(","));
  if (filters.disciplinaIds.length) params.set("disc", filters.disciplinaIds.join(","));
  if (filters.deadlineStatus.length) params.set("d", filters.deadlineStatus.join(","));
  if (filters.dataInicio) params.set("di", filters.dataInicio);
  if (filters.dataFim) params.set("df", filters.dataFim);
  if (sort.key !== "priority" || sort.dir !== "asc") params.set("sort", `${sort.key}.${sort.dir}`);
  if (collapsed.size > 0) params.set("col", [...collapsed].join(","));
  return params;
}

function parseFiltersFromParams(params: URLSearchParams): {
  filters: ProjetosFilters;
  sort: { key: SortKey; dir: SortDir };
  collapsed: Set<string>;
} {
  const sortRaw = params.get("sort");
  const [sk, sd] = (sortRaw || "priority.asc").split(".");
  return {
    filters: {
      search: params.get("q") || "",
      prioridades: (params.get("prio")?.split(",").filter(Boolean) as ProjectPriority[]) || [],
      pessoaIds: params.get("p")?.split(",").filter(Boolean) || [],
      clienteIds: params.get("c")?.split(",").filter(Boolean) || [],
      disciplinaIds: params.get("disc")?.split(",").filter(Boolean) || [],
      deadlineStatus: (params.get("d")?.split(",").filter(Boolean) as DeadlineFilter[]) || [],
      dataInicio: params.get("di") || "",
      dataFim: params.get("df") || "",
    },
    sort: {
      key: (["priority", "dueDate", "value", "name", "created"] as SortKey[]).includes(sk as SortKey)
        ? (sk as SortKey)
        : "priority",
      dir: sd === "desc" ? "desc" : "asc",
    },
    collapsed: new Set(params.get("col")?.split(",").filter(Boolean) || []),
  };
}

export default function ProjetosKanban() {
  usePageTitle("Projetos");
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { data: templatesData = [] } = useTemplates();
  const { data: fluxosData = [] } = useFluxosDisciplinas();
  const canEdit = can("projetos", "create");

  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => parseFiltersFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filters, setFilters] = useState<ProjetosFilters>(initial.filters);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(initial.sort);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(initial.collapsed);

  // Sync state → URL
  useEffect(() => {
    const params = filtersToParams(filters, sort, collapsedColumns);
    setSearchParams(params, { replace: true });
  }, [filters, sort, collapsedColumns, setSearchParams]);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [isDisciplinasOpen, setIsDisciplinasOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("kanban");
  const [isFluxosOpen, setIsFluxosOpen] = useState(false);
  const [projetoToDelete, setProjetoToDelete] = useState<{ id: string; nome: string } | null>(null);

  const [pendingDrag, setPendingDrag] = useState<{
    projetoId: string;
    newStatus: string;
    clienteEmail?: string;
    clienteNome?: string;
    projetoNome?: string;
  } | null>(null);

  const { data: currentUser = null } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      return {
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
        email: user.email || "",
      };
    },
  });

  const { data: projetos = [], isLoading: loadingProjetos } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select(
          `
          *,
          clientes (nome, email),
          projeto_disciplinas (
            id, nome, status, data_inicio, data_fim, data_fim_real,
            prioridade, justificativa_atraso, horas_estimadas, custo_hora,
            observacoes, created_at, updated_at, projeto_id,
            projeto_disciplina_responsaveis (
              pessoa_id,
              pessoas ( id, nome )
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p) => {
        const proj = p as Record<string, unknown> & {
          clientes?: { nome: string; email: string };
          projeto_disciplinas?: Array<Record<string, unknown>>;
        };
        const rawDiscs = (proj.projeto_disciplinas || []) as Array<{
          id: string;
          projeto_id: string;
          nome: string;
          status: string;
          data_inicio: string | null;
          data_fim: string | null;
          data_fim_real: string | null;
          observacoes: string | null;
          prioridade: string | null;
          justificativa_atraso: string | null;
          horas_estimadas: number;
          custo_hora: number;
          created_at: string;
          updated_at: string;
          projeto_disciplina_responsaveis: Array<{
            pessoa_id: string;
            pessoas: { id: string; nome: string };
          }>;
        }>;

        const dbDiscs: ProjetoDisciplinaDB[] = rawDiscs.map((d) => ({
          id: d.id,
          projeto_id: d.projeto_id,
          nome: d.nome,
          status: d.status,
          data_inicio: d.data_inicio,
          data_fim: d.data_fim,
          data_fim_real: d.data_fim_real,
          observacoes: d.observacoes,
          prioridade: d.prioridade,
          justificativa_atraso: d.justificativa_atraso,
          horas_estimadas: d.horas_estimadas,
          custo_hora: d.custo_hora,
          created_at: d.created_at,
          updated_at: d.updated_at,
          responsaveis:
            d.projeto_disciplina_responsaveis?.map((r) => ({
              id: r.pessoas.id,
              nome: r.pessoas.nome,
            })) || [],
        }));

        return {
          id: proj.id as string,
          codigo_projeto: proj.codigo_projeto as string,
          nome: proj.nome as string,
          cliente_id: proj.cliente_id as string,
          cliente_nome: proj.clientes?.nome,
          cliente_email: proj.clientes?.email,
          localizacao: proj.localizacao as string | undefined,
          parcelas: proj.parcelas as string | undefined,
          area_m2: proj.area_m2 as number | undefined,
          data_inicio: proj.data_inicio as string,
          data_previsao: proj.data_previsao as string,
          data_final: proj.data_final as string | undefined,
          status: proj.status as Projeto["status"],
          prioridade: (proj.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
          valor_contrato: proj.valor_contrato as number,
          observacao: proj.observacao as string,
          disciplinas: dbDiscs.map(dbDisciplinaToLegacy),
        };
      }) as Projeto[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pessoas = [] } = useQuery({
    queryKey: ["pessoas-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: disciplinas = [] } = useQuery({
    queryKey: ["disciplinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("disciplinas").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

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

  const handleMoveStatus = async (projetoId: string, newStatus: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    queryClient.setQueryData(["projetos"], (old: Projeto[] | undefined) =>
      (old || []).map((p) =>
        p.id === projetoId
          ? {
              ...p,
              status: newStatus as Projeto["status"],
              data_final: newStatus === PROJECT_STATUS.CONCLUIDO ? todayStr : p.data_final,
            }
          : p
      )
    );
    const updateData: Record<string, string> = { status: newStatus };
    if (newStatus === PROJECT_STATUS.CONCLUIDO) updateData.data_final = todayStr;
    const { error } = await supabase.from("projetos").update(updateData).eq("id", projetoId);
    if (error) {
      toast.error("Erro ao mover projeto");
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      return;
    }
    toast.success(`Movido para ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`);
    queryClient.invalidateQueries({ queryKey: ["projetos"] });
    const projeto = projetos.find((p) => p.id === projetoId);
    if (newStatus !== PROJECT_STATUS.CANCELADO) {
      setPendingDrag({
        projetoId,
        newStatus,
        clienteEmail: projeto?.cliente_email ?? undefined,
        clienteNome: projeto?.cliente_nome ?? undefined,
        projetoNome: projeto?.nome ?? undefined,
      });
    }
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

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    if (!canEdit) return;

    const newStatus = destination.droppableId as Projeto["status"];
    const todayStr = new Date().toISOString().slice(0, 10);

    queryClient.setQueryData(["projetos"], (old: Projeto[] | undefined) =>
      (old || []).map((projeto) =>
        projeto.id === draggableId
          ? {
              ...projeto,
              status: newStatus,
              data_final: newStatus === PROJECT_STATUS.CONCLUIDO ? todayStr : projeto.data_final,
            }
          : projeto
      )
    );

    try {
      const updateData: Record<string, string> = { status: newStatus };
      if (newStatus === PROJECT_STATUS.CONCLUIDO) updateData.data_final = todayStr;

      const { error } = await supabase.from("projetos").update(updateData).eq("id", draggableId);
      if (error) throw error;

      toast.success("Status atualizado", {
        description: `Projeto movido para ${statusConfig[newStatus].label}`,
      });

      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      const projeto = projetos.find((p) => p.id === draggableId);

      if (newStatus !== PROJECT_STATUS.CANCELADO) {
        setPendingDrag({
          projetoId: draggableId,
          newStatus,
          clienteEmail: projeto?.cliente_email ?? undefined,
          clienteNome: projeto?.cliente_nome ?? undefined,
          projetoNome: projeto?.nome ?? undefined,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao atualizar status", { description: message });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    }
  };

  const notifyProjectStatusChange = async (draggableId: string, newStatus: string) => {
    try {
      const { error } = await supabase.functions.invoke("notify-project-people", {
        body: { projetoId: draggableId, novoStatus: newStatus },
      });
      if (error) {
        toast.error("Erro ao enviar notificação por email");
        return;
      }
      toast.success("Notificação por email enviada");
    } catch (err) {
      monitoring.captureException(err, { context: "notifyProjectStatusChange" });
    }
  };

  const sendClientEmail = async (client: string, project: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-completion-email", {
        body: { email: client, name: project, type: "project" },
      });
      if (error) {
        toast.error("Erro ao notificar cliente por email");
        return;
      }
      toast.success("Email de conclusão enviado para o cliente");
    } catch (err) {
      monitoring.captureException(err, { context: "sendClientEmail" });
    }
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
      const prev = projeto.data_previsao;
      if (!prev) return false;
      if (filters.dataInicio && prev < filters.dataInicio) return false;
      if (filters.dataFim && prev > filters.dataFim) return false;
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

  const getProjetosByStatus = (status: string) =>
    filteredProjetos.filter((p) => p.status === status).sort(sortProjetos);

  const toggleColumn = (status: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const tabs: { id: Tab; label: string; icon: typeof CalendarIcon }[] = [
    { id: "kanban", label: "Quadro", icon: CalendarIcon },
    { id: "disciplinas", label: "Disciplinas", icon: Layers },
    { id: "cronograma", label: "Cronograma", icon: CalendarIcon },
  ];

  const noProjetos = !loadingProjetos && projetos.length === 0;
  const noResults = !loadingProjetos && projetos.length > 0 && filteredProjetos.length === 0;

  return (
    <PageLayout
      className={activeTab === "kanban" ? "overflow-y-hidden" : undefined}
      containerClassName={activeTab === "kanban" ? "h-full flex flex-col min-h-0" : undefined}
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

      {/* Abas */}
      <div className="flex items-center gap-0 border-b mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm transition-colors -mb-px rounded-t-md border border-transparent",
              activeTab === tab.id
                ? "bg-brand border-brand text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty states globais */}
      {noProjetos && activeTab === "kanban" && (
        <ProjetosEmptyState variant="no-projetos" onCreate={canEdit ? handleNewProjeto : undefined} />
      )}

      {activeTab === "kanban" && !noProjetos ? (
        <>
          {noResults ? (
            <ProjetosEmptyState variant="no-results" onClearFilters={() => setFilters(EMPTY_FILTERS)} />
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex-1 min-h-0">
                {/* Desktop kanban */}
                <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
                  {Object.entries(statusConfig).map(([status, config]) => {
                    const items = getProjetosByStatus(status);
                    const isCollapsed = collapsedColumns.has(status);
                    const dotColor = STATUS_DOT[status] || "bg-status-unknown";

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
                          <h3 className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
                            {config.label}
                          </h3>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
                          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ColumnSortMenu sort={sort} onChange={setSort} />
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
                              {loadingProjetos && <ProjetoColumnSkeleton count={2} />}
                              {!loadingProjetos && items.length === 0 && !snapshot.isDraggingOver && (
                                <div className="flex items-center justify-center py-6 text-[11px] text-muted-foreground/60 text-center px-2">
                                  Solte um projeto aqui
                                </div>
                              )}
                              {items.map((projeto, index) => (
                                <Draggable key={projeto.id} draggableId={projeto.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                    >
                                      <ProjectCard
                                        projeto={projeto}
                                        onClick={handleCardClick}
                                        onEdit={handleEditClick}
                                        onDelete={handleDelete}
                                        canEdit={canEdit}
                                        isDragging={snapshot.isDragging}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              {canEdit && !loadingProjetos && (
                                <QuickAddCard
                                  status={status as ProjectStatus}
                                  clientes={clientes}
                                  onCreated={() => queryClient.invalidateQueries({ queryKey: ["projetos"] })}
                                />
                              )}
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
                    const items = getProjetosByStatus(status);
                    const dotColor = STATUS_DOT[status] || "bg-status-unknown";
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
                          {items.map((projeto) => (
                            <ProjectCard
                              key={projeto.id}
                              projeto={projeto}
                              onClick={handleCardClick}
                              onEdit={handleEditClick}
                              onDelete={handleDelete}
                              onMoveStatus={canEdit ? handleMoveStatus : undefined}
                              canEdit={canEdit}
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
        </>
      ) : activeTab === "disciplinas" ? (
        <DisciplinasTab projetos={filteredProjetos} />
      ) : activeTab === "cronograma" ? (
        <CronogramaProjetosTab projetos={filteredProjetos} />
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

      <AlertDialog open={!!pendingDrag} onOpenChange={(open) => !open && setPendingDrag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notificar sobre a mudança de status?</AlertDialogTitle>
            <AlertDialogDescription>
              Mover o projeto para{" "}
              <strong>
                {pendingDrag
                  ? (statusConfig[pendingDrag.newStatus as keyof typeof statusConfig]?.label ?? pendingDrag.newStatus)
                  : ""}
              </strong>{" "}
              enviará e-mails para:
              <ul className="mt-2 list-disc pl-4 text-sm">
                <li>Todos os membros alocados no projeto</li>
                {pendingDrag?.newStatus === PROJECT_STATUS.CONCLUIDO && pendingDrag.clienteEmail && (
                  <li>
                    Cliente{pendingDrag.clienteNome ? ` ${pendingDrag.clienteNome}` : ""} ({pendingDrag.clienteEmail})
                  </li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDrag(null)}>Não notificar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand hover:bg-brand/90 text-ink"
              onClick={async () => {
                if (pendingDrag) {
                  await notifyProjectStatusChange(pendingDrag.projetoId, pendingDrag.newStatus);
                  if (
                    pendingDrag.newStatus === PROJECT_STATUS.CONCLUIDO &&
                    pendingDrag.clienteEmail &&
                    pendingDrag.projetoNome
                  ) {
                    await sendClientEmail(pendingDrag.clienteEmail, pendingDrag.projetoNome);
                  }
                  setPendingDrag(null);
                }
              }}
            >
              Sim, enviar e-mails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog
        open={!!projetoToDelete}
        onOpenChange={(open) => !open && setProjetoToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Projeto"
        itemName={projetoToDelete?.nome}
        description="Esta ação não pode ser desfeita. Todos os dados do projeto serão removidos."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}

interface ColumnSortMenuProps {
  sort: { key: SortKey; dir: SortDir };
  onChange: (sort: { key: SortKey; dir: SortDir }) => void;
}

function ColumnSortMenu({ sort, onChange }: ColumnSortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          title="Ordenar"
          aria-label="Ordenar"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide">Ordenar por</DropdownMenuLabel>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <DropdownMenuItem
            key={k}
            onClick={() => onChange({ ...sort, key: k })}
            className={cn("text-xs", sort.key === k && "bg-muted font-medium")}
          >
            {k === "name" && <ArrowDownAZ className="h-3.5 w-3.5 mr-2" />}
            {SORT_LABELS[k]}
            {sort.key === k && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs"
          onClick={() => onChange({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}
        >
          {sort.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 mr-2" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 mr-2" />
          )}
          Direção: {sort.dir === "asc" ? "Crescente" : "Decrescente"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
