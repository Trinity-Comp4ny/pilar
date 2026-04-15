import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, Layers, Calendar as CalendarIcon, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  PROJECT_STATUS,
  PROJECT_STATUS_CONFIG,
  PROJECT_PRIORITY,
  PROJECT_PRIORITY_CONFIG,
  type ProjectPriority,
} from "@/constants";
import { type Projeto } from "@/pages/projetos/types";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";
import { ProjectDetailDialog } from "@/pages/projetos/components/ProjectDetailDialog";
import { ProjetoFormDialog } from "@/pages/projetos/components/ProjetoFormDialog";
import { ManageDisciplinasDialog } from "@/pages/projetos/components/ManageDisciplinasDialog";
import { DisciplinasTab } from "@/pages/projetos/components/DisciplinasTab";
import { useTemplates } from "@/hooks/useTemplates";
import { cn } from "@/lib/utils";

const statusConfig = PROJECT_STATUS_CONFIG;

type Tab = "kanban" | "disciplinas";

export default function ProjetosKanban() {
  const { data: userRole } = useUserRole();
  const { toast } = useToast();
  const { data: templatesData = [] } = useTemplates();
  const canEdit = userRole === "admin" || userRole === "operacional";

  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [disciplinas, setDisciplinas] = useState<{ id: string; nome: string }[]>([]);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [isDisciplinasOpen, setIsDisciplinasOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("kanban");
  const [filterPessoaId, setFilterPessoaId] = useState<string>("all");

  useEffect(() => {
    fetchData();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser({
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
        email: user.email || "",
      });
    }
  };

  const fetchData = async () => {
    const { data: clientesData } = await supabase.from("clientes").select("id, nome").order("nome");
    if (clientesData) setClientes(clientesData);

    const { data: pessoasData } = await supabase.from("pessoas").select("id, nome").order("nome");
    if (pessoasData) setPessoas(pessoasData);

    fetchDisciplinas();
    fetchProjetos();
  };

  const fetchDisciplinas = async () => {
    const { data } = await supabase.from("disciplinas").select("id, nome").order("nome");
    if (data) setDisciplinas(data);
  };

  const fetchProjetos = async () => {
    const { data, error } = await supabase
      .from("projetos")
      .select(`*, clientes (nome)`)
      .order("created_at", { ascending: false });

    if (error) return;

    if (data) {
      const mappedProjetos: Projeto[] = data.map((p: Record<string, unknown> & { clientes?: { nome: string } }) => ({
        id: p.id as string,
        codigo_projeto: p.codigo_projeto as string,
        nome: p.nome as string,
        cliente_id: p.cliente_id as string,
        cliente_nome: p.clientes?.nome,
        localizacao: p.localizacao as string | undefined,
        parcelas: p.parcelas as string | undefined,
        area_m2: p.area_m2 as number | undefined,
        data_inicio: p.data_inicio as string,
        data_previsao: p.data_previsao as string,
        data_final: p.data_final as string | undefined,
        status: p.status as Projeto["status"],
        prioridade: (p.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
        valor_contrato: p.valor_contrato as number,
        observacao: p.observacao as string,
        disciplinas: Array.isArray(p.disciplinas) ? p.disciplinas : [],
      }));
      setProjetos(mappedProjetos);
    }
  };

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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("projetos").delete().eq("id", id);
    if (!error) {
      toast({ title: "Projeto excluído" });
      setIsDetailOpen(false);
      fetchProjetos();
    } else {
      toast({
        title: "Erro ao excluir",
        description: "Verifique se existem registros vinculados.",
        variant: "destructive",
      });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    if (!canEdit) return;

    const newStatus = destination.droppableId as Projeto["status"];
    const todayStr = new Date().toISOString().slice(0, 10);

    setProjetos((prevProjetos) =>
      prevProjetos.map((projeto) =>
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
      if (newStatus === PROJECT_STATUS.CONCLUIDO) {
        updateData.data_final = todayStr;
      }

      const { error } = await supabase.from("projetos").update(updateData).eq("id", draggableId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Projeto movido para ${statusConfig[newStatus].label}`,
      });

      fetchProjetos();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao atualizar status",
        description: message,
        variant: "destructive",
      });
      fetchProjetos();
    }
  };

  const getProjetosByStatus = (status: string) => {
    return projetos
      .filter((projeto) => {
        if (projeto.status !== status) return false;
        if (filterPessoaId === "all") return true;
        return projeto.disciplinas?.some((d) => {
          if (d.responsavel_id === filterPessoaId) return true;
          if (d.responsaveis?.some((r) => r.responsavel_id === filterPessoaId)) return true;
          return false;
        });
      })
      .sort((a, b) => {
        const wa = PROJECT_PRIORITY_CONFIG[a.prioridade as ProjectPriority]?.sortWeight ?? 1;
        const wb = PROJECT_PRIORITY_CONFIG[b.prioridade as ProjectPriority]?.sortWeight ?? 1;
        return wa - wb;
      });
  };

  const tabs: { id: Tab; label: string; icon: typeof CalendarIcon }[] = [
    { id: "kanban", label: "Kanban", icon: CalendarIcon },
    { id: "disciplinas", label: "Disciplinas", icon: Layers },
  ];

  return (
    <PageLayout
      className={activeTab === "kanban" ? "overflow-y-hidden" : undefined}
      containerClassName={activeTab === "kanban" ? "h-full flex flex-col min-h-0" : undefined}
      header={
        <PageHeader
          title="Projetos"
          description="Gerencie seus projetos"
          children={
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterPessoaId} onValueChange={setFilterPessoaId}>
                  <SelectTrigger className="w-[180px] h-9 text-xs rounded-full">
                    <SelectValue placeholder="Filtrar por pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as pessoas</SelectItem>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canEdit && (
                <Button variant="outline" className="rounded-full text-sm" onClick={() => setIsDisciplinasOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Disciplinas
                </Button>
              )}

              {canEdit && (
                <Button
                  className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm"
                  onClick={handleNewProjeto}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Projeto
                </Button>
              )}
            </div>
          }
        />
      }
    >
      {/* Abas */}
      <div className="flex items-center gap-1 border-b mb-4 -mt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-accent-orange text-accent-orange"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "kanban" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 min-h-0">
            <div className="flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
              {Object.entries(statusConfig).map(([status, config]) => (
                <div key={status} className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 min-h-0">
                  <div className={`${config.columnColor} rounded-t-lg p-3 border-b border-black/10`}>
                    <h3 className="font-medium text-sm flex items-center justify-between">
                      {config.label}
                      <Badge variant="secondary" className="ml-2">
                        {getProjetosByStatus(status).length}
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
                        {getProjetosByStatus(status).map((projeto, index) => (
                          <Draggable key={projeto.id} draggableId={projeto.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                <ProjectCard
                                  projeto={projeto}
                                  onClick={handleCardClick}
                                  isDragging={snapshot.isDragging}
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
              ))}
            </div>
          </div>
        </DragDropContext>
      ) : (
        <DisciplinasTab projetos={projetos} />
      )}

      <ProjectDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        projeto={selectedProjeto}
        canEdit={canEdit}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        onProjectUpdated={fetchProjetos}
      />

      <ProjetoFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        editProjeto={editingProjeto}
        clientes={clientes}
        pessoas={pessoas}
        disciplinas={disciplinas}
        templatesData={templatesData}
        currentUser={currentUser}
        onSaved={fetchProjetos}
      />

      <ManageDisciplinasDialog
        open={isDisciplinasOpen}
        onOpenChange={setIsDisciplinasOpen}
        disciplinas={disciplinas}
        onDisciplinasChanged={fetchDisciplinas}
      />
    </PageLayout>
  );
}
