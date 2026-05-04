import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Layers, DollarSign, Table as TableIcon, GanttChart } from "lucide-react";
import { SecondSidebar, type SecondSidebarTab } from "@/components/SecondSidebar";
import { cn } from "@/lib/utils";
import { type Projeto, type DisciplinaResponsavel, type ProjetoDisciplinaDB } from "@/types/projetos";
import { CronogramaTab } from "./CronogramaTab";
import { PagamentosTab } from "./PagamentosTab";
import { DisciplinasTableView } from "./DisciplinasTableView";

interface ProjetoDetailTabsProps {
  projeto: Projeto;
  canEdit: boolean;
  disciplinasLegacy: DisciplinaResponsavel[];
  dbDisciplinas: ProjetoDisciplinaDB[];
  disciplinasCatalog: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  getDbDisc: (idx: number) => ProjetoDisciplinaDB | undefined;
  applyDiscStatusChange: (idx: number, newStatus: string, justificativa?: string) => Promise<void>;
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
];

type DisciplinaView = "tabela" | "gantt";

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
                      applyDiscStatusChange={applyDiscStatusChange}
                      handleRemoveDisc={handleRemoveDisc}
                      handleAddDisc={handleAddDisc}
                      handleSaveDiscChanges={handleSaveDiscChanges}
                      handleAddResponsavel={handleAddResponsavel}
                      handleRemoveResponsavel={handleRemoveResponsavel}
                    />
                  </CardContent>
                </Card>
              ) : (
                <CronogramaTab
                  disciplinas={disciplinasLegacy}
                  projetoDataInicio={projeto.data_inicio}
                  projetoDataPrevisao={projeto.data_previsao}
                  onDatesChange={canEdit ? handleCronogramaDatesChange : undefined}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="pagamentos">
            <PagamentosTab projetoId={projeto.id} canEdit={canEdit} />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
