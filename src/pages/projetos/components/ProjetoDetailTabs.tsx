import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Layers, DollarSign, ScrollText, Table as TableIcon, GanttChart, GitBranch } from "lucide-react";
import { SecondSidebar, type SecondSidebarTab } from "@/components/SecondSidebar";
import { cn } from "@/lib/utils";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type ProjetoDisciplinaDB,
  type DisciplinaComentario,
} from "@/types/projetos";
import { type LinkItem } from "@/components/LinksEditor";
import { useAuth } from "@/contexts/AuthContext";
import { CronogramaTab } from "./CronogramaTab";
import { PagamentosTab } from "./PagamentosTab";
import { EscopoTab } from "./EscopoTab";
import { DisciplinasTableView } from "./DisciplinasTableView";
import { DisciplinaDetailDialog } from "./DisciplinaDetailDialog";
import { FluxoPipeline } from "./FluxoPipeline";
import { useProjetoDisciplinaChecklistCounts } from "@/hooks/useProjetoDisciplinaChecklist";

interface ProjetoDetailTabsProps {
  projeto: Projeto;
  canEdit: boolean;
  disciplinasLegacy: DisciplinaResponsavel[];
  dbDisciplinas: ProjetoDisciplinaDB[];
  disciplinasCatalog: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  getDbDisc: (idx: number) => ProjetoDisciplinaDB | undefined;
  applyDiscStatusChange: (
    idx: number,
    newStatus: string,
    justificativa?: string,
    dataFimRealOverride?: string
  ) => Promise<void>;
  handleRemoveDisc: (idx: number) => Promise<void>;
  handleAddDisc: (newDisc: { disciplina: string; responsavel_id: string }) => Promise<void>;
  handleSaveDiscChanges: (editingDiscLocal: ProjetoDisciplinaDB) => Promise<void>;
  handleAddResponsavel: (discIdx: number, responsavelId: string) => Promise<void>;
  handleRemoveResponsavel: (discIdx: number, respIdx: number) => Promise<void>;
}

// Hash "cronograma" mantido como alias retrocompat → abre Disciplinas com view Gantt
const PROJETO_TABS: SecondSidebarTab[] = [
  { id: "disciplinas", label: "Disciplinas", icon: Layers },
  { id: "pagamentos", label: "Pagamentos", icon: DollarSign },
  { id: "escopo", label: "Escopo", icon: ScrollText },
];

type DisciplinaView = "tabela" | "gantt" | "fluxo";

export function ProjetoDetailTabs({
  projeto,
  canEdit,
  disciplinasLegacy,
  dbDisciplinas,
  disciplinasCatalog,
  pessoas,
  getDbDisc,
  applyDiscStatusChange,
  handleRemoveDisc,
  handleAddDisc,
  handleSaveDiscChanges,
  handleAddResponsavel,
  handleRemoveResponsavel,
}: ProjetoDetailTabsProps) {
  const { profile } = useAuth();
  const { data: checklistCounts } = useProjetoDisciplinaChecklistCounts(projeto.id);

  const handleCronogramaDatesChange = async (
    discIdx: number,
    updates: { data_inicio?: string; data_previsao?: string }
  ) => {
    const dbDisc = getDbDisc(discIdx);
    if (!dbDisc) return;
    await handleSaveDiscChanges({
      ...dbDisc,
      ...(updates.data_inicio !== undefined && { data_inicio: updates.data_inicio }),
      ...(updates.data_previsao !== undefined && { data_fim: updates.data_previsao }),
    });
  };

  const location = useLocation();
  const navigate = useNavigate();

  const resolveFromHash = (hash: string): { tab: string; view: DisciplinaView | null } => {
    const h = hash.replace("#", "");
    if (h === "cronograma") return { tab: "disciplinas", view: "gantt" };
    if (h === "pagamentos") return { tab: "pagamentos", view: null };
    if (h === "escopo") return { tab: "escopo", view: null };
    return { tab: "disciplinas", view: null };
  };

  const initial = resolveFromHash(location.hash);
  const [activeTab, setActiveTab] = useState(initial.tab);
  const [disciplinaView, setDisciplinaView] = useState<DisciplinaView>(
    initial.view ?? (localStorage.getItem("pilar-disc-view") as DisciplinaView) ?? "tabela"
  );

  const handleViewChange = (v: DisciplinaView) => {
    setDisciplinaView(v);
    localStorage.setItem("pilar-disc-view", v);
  };

  const [selectedDisc, setSelectedDisc] = useState<DisciplinaResponsavel | null>(null);
  const [discDialogOpen, setDiscDialogOpen] = useState(false);
  const [newObservation, setNewObservation] = useState("");

  const handleDiscClick = (disc: DisciplinaResponsavel) => {
    setSelectedDisc(disc);
    setDiscDialogOpen(true);
  };

  const handleDiscUpdateField = async (field: keyof DisciplinaResponsavel, value: string) => {
    if (!selectedDisc) return;
    const discIdx = disciplinasLegacy.findIndex((d) => d.disciplina === selectedDisc.disciplina);
    if (discIdx < 0) return;
    const dbDisc = getDbDisc(discIdx);
    if (!dbDisc) return;
    const fieldMap: Partial<Record<keyof DisciplinaResponsavel, keyof ProjetoDisciplinaDB>> = {
      observacoes: "observacoes",
      data_inicio: "data_inicio",
      data_previsao: "data_fim",
      data_final: "data_fim_real",
      status: "status",
      justificativa_atraso: "justificativa_atraso",
    };
    const dbField = fieldMap[field] ?? (field as keyof ProjetoDisciplinaDB);
    await handleSaveDiscChanges({ ...dbDisc, [dbField]: value });
    setSelectedDisc((prev) => prev && { ...prev, [field]: value });
  };

  const handleDiscUpdateResponsaveis = async (ids: string[]) => {
    if (!selectedDisc) return;
    const discIdx = disciplinasLegacy.findIndex((d) => d.disciplina === selectedDisc.disciplina);
    if (discIdx < 0) return;
    const dbDisc = getDbDisc(discIdx);
    if (!dbDisc) return;
    const updatedResps = ids.map((id) => ({ id, nome: pessoas.find((p) => p.id === id)?.nome || "" }));
    await handleSaveDiscChanges({ ...dbDisc, responsaveis: updatedResps });
    setSelectedDisc(
      (prev) =>
        prev && {
          ...prev,
          responsavel_id: updatedResps[0]?.id || "",
          responsavel_nome: updatedResps[0]?.nome || "",
          responsaveis: updatedResps.map((r) => ({ responsavel_id: r.id, responsavel_nome: r.nome })),
        }
    );
  };

  const handleAddObservation = async () => {
    if (!selectedDisc || !newObservation.trim()) return;
    const obs = selectedDisc.observacoes
      ? `${selectedDisc.observacoes}\n${newObservation.trim()}`
      : newObservation.trim();
    await handleDiscUpdateField("observacoes", obs);
    setNewObservation("");
  };

  // Campos que não são string simples (arrays, números, descrição): handlers
  // dedicados, porque onUpdateField só trafega string (spec 013).
  const saveDiscPatch = async (
    patch: Partial<
      Pick<
        ProjetoDisciplinaDB,
        "labels" | "links" | "comentarios" | "descricao" | "horas_estimadas" | "horas_realizadas"
      >
    >
  ) => {
    if (!selectedDisc) return;
    const discIdx = disciplinasLegacy.findIndex((d) => d.disciplina === selectedDisc.disciplina);
    if (discIdx < 0) return;
    const dbDisc = getDbDisc(discIdx);
    if (!dbDisc) return;
    await handleSaveDiscChanges({ ...dbDisc, ...patch });
    // patch usa chaves de ProjetoDisciplinaDB (descricao pode ser null); no shape
    // legacy é string|undefined e nunca gravamos null aqui — cast seguro.
    setSelectedDisc((prev) => (prev ? ({ ...prev, ...patch } as DisciplinaResponsavel) : prev));
  };

  const handleDiscUpdateLabels = (next: string[]) => saveDiscPatch({ labels: next });
  const handleDiscUpdateLinks = (next: LinkItem[]) => saveDiscPatch({ links: next });
  const handleDiscUpdateComentarios = (next: DisciplinaComentario[]) => saveDiscPatch({ comentarios: next });
  const handleDiscUpdateDescricao = (next: string) => saveDiscPatch({ descricao: next });
  const handleDiscUpdateHorasEstimadas = (n: number) => saveDiscPatch({ horas_estimadas: n });
  const handleDiscUpdateHorasRealizadas = (n: number) => saveDiscPatch({ horas_realizadas: n });

  const autorNome =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || profile?.email || "Usuário";

  useEffect(() => {
    const { tab, view } = resolveFromHash(location.hash);
    if (tab !== activeTab) setActiveTab(tab);
    if (view) setDisciplinaView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash]);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    navigate(`#${v}`, { replace: true });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <div className="flex flex-col md:flex-row gap-4 md:items-start">
        <SecondSidebar
          tabs={PROJETO_TABS}
          value={activeTab}
          onValueChange={handleTabChange}
          className="sticky top-0 rounded-lg border border-black/5"
        />
        <div className="flex-1 min-w-0">
          <TabsContent value="disciplinas">
            <div className="space-y-3">
              {/* Toggle de visualização */}
              <div className="flex items-center justify-end">
                <div className="flex items-center border rounded-md overflow-hidden">
                  <Button
                    variant={disciplinaView === "tabela" ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("h-8 text-xs rounded-none px-3 gap-1.5")}
                    onClick={() => handleViewChange("tabela")}
                  >
                    <TableIcon className="h-3.5 w-3.5" /> Tabela
                  </Button>
                  <Button
                    variant={disciplinaView === "gantt" ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("h-8 text-xs rounded-none px-3 gap-1.5")}
                    onClick={() => handleViewChange("gantt")}
                  >
                    <GanttChart className="h-3.5 w-3.5" /> Gantt
                  </Button>
                  <Button
                    variant={disciplinaView === "fluxo" ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("h-8 text-xs rounded-none px-3 gap-1.5")}
                    onClick={() => handleViewChange("fluxo")}
                  >
                    <GitBranch className="h-3.5 w-3.5" /> Fluxo
                  </Button>
                </div>
              </div>

              {disciplinaView === "tabela" ? (
                <Card>
                  <CardContent className="p-4">
                    <DisciplinasTableView
                      canEdit={canEdit}
                      disciplinasLegacy={disciplinasLegacy}
                      dbDisciplinas={dbDisciplinas}
                      disciplinasCatalog={disciplinasCatalog}
                      pessoas={pessoas}
                      checklistCounts={checklistCounts}
                      applyDiscStatusChange={applyDiscStatusChange}
                      handleRemoveDisc={handleRemoveDisc}
                      handleAddDisc={handleAddDisc}
                      handleSaveDiscChanges={handleSaveDiscChanges}
                      handleAddResponsavel={handleAddResponsavel}
                      handleRemoveResponsavel={handleRemoveResponsavel}
                      projetoDataInicio={projeto.data_inicio}
                      projetoDataPrevisao={projeto.data_previsao}
                    />
                  </CardContent>
                </Card>
              ) : disciplinaView === "gantt" ? (
                <CronogramaTab
                  disciplinas={disciplinasLegacy}
                  projetoDataInicio={projeto.data_inicio}
                  projetoDataPrevisao={projeto.data_previsao}
                  onDatesChange={canEdit ? handleCronogramaDatesChange : undefined}
                  onDisciplinaClick={handleDiscClick}
                />
              ) : (
                <FluxoPipeline
                  disciplinas={disciplinasLegacy}
                  onOpenDisciplina={handleDiscClick}
                  checklistCounts={checklistCounts}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="pagamentos">
            <PagamentosTab projetoId={projeto.id} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="escopo">
            <EscopoTab
              projetoId={projeto.id}
              canEdit={canEdit}
              disciplinas={Array.from(new Set(dbDisciplinas.map((d) => d.nome)))}
            />
          </TabsContent>
        </div>
      </div>

      <DisciplinaDetailDialog
        open={discDialogOpen}
        onOpenChange={setDiscDialogOpen}
        disciplina={selectedDisc}
        disciplinas={disciplinasCatalog}
        pessoas={pessoas}
        onUpdateField={handleDiscUpdateField}
        onUpdateResponsaveis={handleDiscUpdateResponsaveis}
        onUpdateLabels={handleDiscUpdateLabels}
        onUpdateLinks={handleDiscUpdateLinks}
        onUpdateComentarios={handleDiscUpdateComentarios}
        onUpdateDescricao={handleDiscUpdateDescricao}
        onUpdateHorasEstimadas={handleDiscUpdateHorasEstimadas}
        onUpdateHorasRealizadas={handleDiscUpdateHorasRealizadas}
        autorNome={autorNome}
        newObservation={newObservation}
        onNewObservationChange={setNewObservation}
        onAddObservation={handleAddObservation}
        projetoDataInicio={projeto.data_inicio}
        projetoDataPrevisao={projeto.data_previsao}
        onDelete={
          canEdit && selectedDisc
            ? async () => {
                const idx = disciplinasLegacy.findIndex((d) => d.disciplina === selectedDisc.disciplina);
                setDiscDialogOpen(false);
                if (idx >= 0) await handleRemoveDisc(idx);
              }
            : undefined
        }
      />
    </Tabs>
  );
}
