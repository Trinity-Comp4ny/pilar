import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProjetoDetail } from "./hooks/useProjetoDetail";
import { ProjetoDetailHeader } from "./components/ProjetoDetailHeader";
import { ProjetoDetailInfo } from "./components/ProjetoDetailInfo";
import { ProjetoDetailTabs } from "./components/ProjetoDetailTabs";
import { ProjetoFormDialog } from "./components/ProjetoFormDialog";

export default function ProjetoDetail() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Projeto");
  const navigate = useNavigate();

  const {
    projeto,
    loading,
    canEdit,
    disciplinasLegacy,
    dbDisciplinas,
    disciplinasCatalog,
    pessoas,
    getDbDisc,
    deadline,
    progress,
    margemBrutaPct,
    rentabilidade,
    rentabilidadeLoading,
    applyDiscStatusChange,
    handleRemoveDisc,
    handleAddDisc,
    handleSaveDiscChanges,
    handleAddResponsavel,
    handleRemoveResponsavel,
    clientes,
    currentUser,
    templatesData,
    refetchProjeto,
  } = useProjetoDetail(id);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  if (loading || !projeto) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ProjetoDetailHeader
        projeto={projeto}
        deadline={deadline}
        canEdit={canEdit}
        onBack={() => navigate("/projetos")}
        onEdit={() => setIsEditDialogOpen(true)}
      />

      <ProjetoDetailInfo projeto={projeto} progress={progress} margemBrutaPct={margemBrutaPct} rentabilidade={rentabilidade ?? null} rentabilidadeLoading={rentabilidadeLoading} />

      <ProjetoDetailTabs
        projeto={projeto}
        canEdit={canEdit}
        disciplinasLegacy={disciplinasLegacy}
        dbDisciplinas={dbDisciplinas}
        disciplinasCatalog={disciplinasCatalog}
        pessoas={pessoas}
        getDbDisc={getDbDisc}
        applyDiscStatusChange={applyDiscStatusChange}
        handleRemoveDisc={handleRemoveDisc}
        handleAddDisc={handleAddDisc}
        handleSaveDiscChanges={handleSaveDiscChanges}
        handleAddResponsavel={handleAddResponsavel}
        handleRemoveResponsavel={handleRemoveResponsavel}
      />

      <ProjetoFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editProjeto={projeto}
        clientes={clientes}
        pessoas={pessoas}
        disciplinas={disciplinasCatalog}
        templatesData={templatesData}
        currentUser={currentUser}
        onSaved={refetchProjeto}
        existingDisciplinas={dbDisciplinas}
      />
    </PageLayout>
  );
}
