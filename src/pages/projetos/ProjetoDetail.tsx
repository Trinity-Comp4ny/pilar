import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Globe, Pause, Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { useRecentes } from "@/hooks/useRecentes";
import { useProjetoDetail } from "./hooks/useProjetoDetail";
import { ProjetoDetailHeader } from "./components/ProjetoDetailHeader";
import { CollapsibleKpiSection } from "@/components/CollapsibleKpiSection";
import { KpiResumo } from "@/components/KpiResumo";
import { formatDate, formatPercent } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { ProjetoDetailInfo } from "./components/ProjetoDetailInfo";
import { ProjetoDetailTabs } from "./components/ProjetoDetailTabs";
import { ProjetoFormDialog } from "./components/ProjetoFormDialog";
import { PausarProjetoDialog } from "./components/PausarProjetoDialog";
import { RetomarProjetoDialog } from "./components/RetomarProjetoDialog";
import { useProjetoPausas } from "./hooks/useProjetoPausas";
import { diasDePausa } from "@/pages/projetos/lib/pausa";
import { AcessoPortalDialog } from "@/components/portal/AcessoPortalDialog";

import { ReadingRing } from "@/components/motion/ReadingRing";

export default function ProjetoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can, isAdmin, role } = usePermissions();
  const podeEditarValor = can("financeiro");
  // Acesso ao portal: só admin e coordenador (as edge functions conferem de novo).
  const podeDarAcessoPortal = isAdmin || role === "coordenador";

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
    applyDiscStatusChange,
    handleRemoveDisc,
    handleAddDisc,
    handleSaveDiscChanges,
    handleAddResponsavel,
    handleRemoveResponsavel,
    handleQuickUpdateProjeto,
    handleQuickUpdateStatus,
    pendingReopenStatus,
    setPendingReopenStatus,
    applyStatusUpdate,
    clientes,
    currentUser,
    templatesData,
    refetchProjeto,
  } = useProjetoDetail(id);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // Resumo dos indicadores mascarado como os cards ("ocultar valores").
  const formatCurrency = useMoneyMask();
  const [pausarOpen, setPausarOpen] = useState(false);
  const [retomarOpen, setRetomarOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const { aberta: pausaAberta } = useProjetoPausas(id);
  usePageTitle(projeto?.nome ? `Projeto · ${projeto.nome}` : "Projeto");

  // Recentes da home Início (spec 001): registra a visita quando o projeto carrega.
  const { registrar } = useRecentes();
  useEffect(() => {
    if (id && projeto?.nome) registrar({ tipo: "projeto", rota: `/projetos/${id}`, label: projeto.nome });
  }, [id, projeto?.nome, registrar]);

  if (!loading && !projeto) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">Projeto não encontrado ou sem acesso.</p>
          <Button variant="outline" onClick={() => navigate("/projetos")}>
            Voltar para projetos
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (loading || !projeto) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-12">
          <ReadingRing size={64} />
        </div>
      </PageLayout>
    );
  }

  const pausado = projeto.status === "Paralisado";
  const podePausar = !pausado && projeto.status !== "Concluído" && projeto.status !== "Cancelado";

  // Pausar e retomar passam pelos diálogos (motivo, antes e depois dos prazos),
  // nunca pela troca direta de status.
  const handleStatusDoCabecalho = (status: string) => {
    if (status === "Paralisado" && !pausado) return setPausarOpen(true);
    if (status !== "Paralisado" && pausado) return setRetomarOpen(true);
    handleQuickUpdateStatus(status);
  };

  return (
    <PageLayout
      density="compact"
      header={
        <PageHeader
          title={projeto.nome}
          breadcrumbs={[{ label: "Projetos", to: "/projetos" }]}
          acoes={[
            ...(canEdit && pausado
              ? [{ label: "Retomar projeto", icon: Play, onClick: () => setRetomarOpen(true), destaque: true }]
              : []),
            ...(canEdit && podePausar
              ? [{ label: "Pausar projeto", icon: Pause, onClick: () => setPausarOpen(true) }]
              : []),
            ...(podeDarAcessoPortal && projeto.cliente_id
              ? [{ label: "Portal do cliente", icon: Globe, onClick: () => setPortalOpen(true) }]
              : []),
            ...(canEdit ? [{ label: "Editar", icon: Pencil, onClick: () => setIsEditDialogOpen(true) }] : []),
          ]}
        />
      }
    >
      {pausado && pausaAberta && (
        <div role="status" className="rounded-lg border border-status-paused bg-muted px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">
            Projeto pausado desde {new Date(pausaAberta.pausado_em).toLocaleDateString("pt-BR")} (
            {diasDePausa(pausaAberta.pausado_em)} dias)
          </p>
          <p className="text-muted-foreground">Motivo: {pausaAberta.motivo}</p>
          <p className="text-muted-foreground">Os prazos ficam congelados até você retomar.</p>
        </div>
      )}

      {/* Indicadores recolhíveis, com status/prioridade/prazo na mesma linha e um resumo
          quando recolhidos: a 1ª disciplina subia de y=540 (auditoria de espaço, 2026-11). */}
      <CollapsibleKpiSection
        storageKey="projeto-detalhe"
        controls={
          <ProjetoDetailHeader
            projeto={projeto}
            deadline={deadline}
            canEdit={canEdit}
            onUpdateStatus={handleStatusDoCabecalho}
            onUpdatePrioridade={(prioridade) => handleQuickUpdateProjeto({ prioridade })}
          />
        }
        resumo={
          <KpiResumo
            itens={[
              ...(projeto.cliente_nome ? [{ texto: projeto.cliente_nome }] : []),
              ...(projeto.valor_contrato != null
                ? [{ texto: formatCurrency(projeto.valor_contrato, { compact: true }) }]
                : []),
              ...(projeto.data_previsao ? [{ texto: `prazo ${formatDate(projeto.data_previsao)}` }] : []),
              ...(margemBrutaPct !== null
                ? [{ texto: `margem ${formatPercent(margemBrutaPct)}`, alerta: margemBrutaPct < 0 }]
                : []),
              { texto: `${progress}% concluído` },
            ]}
          />
        }
      >
        <ProjetoDetailInfo
          projeto={projeto}
          progress={progress}
          margemBrutaPct={margemBrutaPct}
          canEdit={canEdit}
          onUpdatePrazo={(data_previsao) => handleQuickUpdateProjeto({ data_previsao })}
          // Sem financeiro o valor vem mascarado (null): deixar o campo editável
          // faria o blur enviar 0 e tentar zerar o contrato.
          onUpdateContrato={
            podeEditarValor ? (valor_contrato) => handleQuickUpdateProjeto({ valor_contrato }) : undefined
          }
          onUpdateArea={(area_m2) => handleQuickUpdateProjeto({ area_m2 })}
        />
      </CollapsibleKpiSection>

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

      <PausarProjetoDialog projetoId={id} projetoNome={projeto.nome} open={pausarOpen} onOpenChange={setPausarOpen} />
      <RetomarProjetoDialog
        projetoId={id}
        dataPrevisao={projeto.data_previsao}
        open={retomarOpen}
        onOpenChange={setRetomarOpen}
      />

      {podeDarAcessoPortal && projeto.cliente_id && (
        <AcessoPortalDialog
          open={portalOpen}
          onOpenChange={setPortalOpen}
          clienteId={projeto.cliente_id}
          clienteNome={projeto.cliente_nome ?? "O cliente"}
          clienteEmail={projeto.cliente_email}
        />
      )}

      <ConfirmDialog
        open={pendingReopenStatus !== null}
        onOpenChange={(open) => !open && setPendingReopenStatus(null)}
        onConfirm={() => {
          if (pendingReopenStatus) void applyStatusUpdate(pendingReopenStatus, true);
          setPendingReopenStatus(null);
        }}
        variant="default"
        title="Reabrir projeto"
        description="Este projeto está marcado como concluído. Mudar o status agora limpa a data de conclusão registrada."
        confirmText="Reabrir"
      />
    </PageLayout>
  );
}
