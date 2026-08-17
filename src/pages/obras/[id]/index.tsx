import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Boxes, CalendarClock, ClipboardList, CloudRain, HardHat, LayoutList, MapPin, Pencil, Scale, Trash2, User, Wallet } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { useObra, useDeleteObra } from "@/hooks/useObras";
import { useObraTarefas } from "@/hooks/useObraTarefas";
import { useAlertasClimaCronograma } from "@/hooks/useAlertasClima";
import { formatDate } from "@/lib/format";
import { sensivelClimaLabel } from "@/lib/obras";
import { ObraFormDialog } from "../components/ObraFormDialog";
import { CriarAcessoCampoDialog } from "../components/CriarAcessoCampoDialog";
import { ObraTimelineTab } from "../components/ObraTimelineTab";
import { ObraDiarioTab } from "../components/ObraDiarioTab";
import { ObraCronogramaTab } from "../components/ObraCronogramaTab";
import { ObraContaTab } from "../components/ObraContaTab";
import { ObraCotacoesTab } from "../components/ObraCotacoesTab";
import { ObraEstoqueTab } from "../components/ObraEstoqueTab";

const BREADCRUMB = [{ label: "Obras", to: "/obras" }];

export default function ObraDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can("obras", "edit");
  const canDelete = can("obras", "delete");
  // Sub-features do módulo Obras (spec 035): a aba some quando desligada para a
  // empresa. Timeline ("Visão") é a base do módulo e segue só o gate de "obras".
  const showDiario = can("obras_diario", "view");
  const showCronograma = can("obras_cronograma", "view");
  const showCotacoes = can("obras_cotacoes", "view");
  const showEstoque = can("obras_estoque", "view");
  const showConta = can("obras_conta", "view");

  const { data: obra, isLoading } = useObra(id);
  usePageTitle(obra?.nome ?? "Obra");

  const [tab, setTab] = useState("timeline");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [acessoCampoOpen, setAcessoCampoOpen] = useState(false);
  const del = useDeleteObra();

  // Alertas de clima: etapas sensíveis do cronograma vs previsão (spec 040).
  const { data: tarefasObra = [] } = useObraTarefas(id);
  const alertasClima = useAlertasClimaCronograma(obra?.latitude, obra?.longitude, tarefasObra);

  if (isLoading) {
    return (
      <PageLayout header={<PageHeader title="Carregando…" breadcrumbs={BREADCRUMB} />}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </PageLayout>
    );
  }

  if (!obra || !id) {
    return (
      <PageLayout header={<PageHeader title="Obra não encontrada" breadcrumbs={BREADCRUMB} />}>
        <p className="text-sm text-muted-foreground">
          Esta obra não existe ou foi removida.{" "}
          <button onClick={() => navigate("/obras")} className="underline">
            Voltar para Obras
          </button>
        </p>
      </PageLayout>
    );
  }

  const handleDelete = async () => {
    try {
      await del.mutateAsync(obra.id);
      toast.success("Obra removida");
      navigate("/obras");
    } catch (e) {
      toast.error("Não foi possível remover", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  return (
    <PageLayout
      header={
        <PageHeader title={obra.nome} breadcrumbs={BREADCRUMB}>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setAcessoCampoOpen(true)}>
                <HardHat className="mr-1.5 h-4 w-4" />
                Acesso de campo
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" onClick={() => setConfirmDel(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Excluir
              </Button>
            )}
          </div>
        </PageHeader>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <StatusBadge domain="obra" status={obra.status} />
        {obra.projeto?.nome && <span>{obra.projeto.nome}</span>}
        <span className="inline-flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {obra.responsavel?.nome ?? "Sem responsável"}
        </span>
        {(obra.cidade || obra.localizacao) && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {obra.localizacao || obra.cidade}
          </span>
        )}
        {(obra.data_inicio_prevista || obra.data_fim_prevista) && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {obra.data_inicio_prevista ? formatDate(obra.data_inicio_prevista) : "?"} —{" "}
            {obra.data_fim_prevista ? formatDate(obra.data_fim_prevista) : "?"}
          </span>
        )}
      </div>

      {alertasClima.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-warning-soft bg-warning-soft/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-warning-strong">
            <CloudRain className="h-4 w-4" />
            Clima pode atrapalhar {alertasClima.length === 1 ? "uma etapa" : `${alertasClima.length} etapas`}
          </div>
          <ul className="space-y-0.5 text-sm text-ink/90">
            {alertasClima.slice(0, 4).map((a) => (
              <li key={a.tarefaId}>
                <span className="font-medium">{a.titulo}</span> ({sensivelClimaLabel(a.tipo)}): {a.detalhe} em{" "}
                {formatDate(a.data)}. Reprograme.
              </li>
            ))}
          </ul>
          {showCronograma && (
            <Button variant="outline" size="sm" className="mt-1" onClick={() => setTab("cronograma")}>
              Ver cronograma
            </Button>
          )}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline" className="flex items-center gap-1.5">
            <LayoutList className="h-3.5 w-3.5" />
            Visão
          </TabsTrigger>
          {showDiario && (
            <TabsTrigger value="diario" className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Diário
            </TabsTrigger>
          )}
          {showCronograma && (
            <TabsTrigger value="cronograma" className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Cronograma
            </TabsTrigger>
          )}
          {showCotacoes && (
            <TabsTrigger value="cotacoes" className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              Cotações
            </TabsTrigger>
          )}
          {showEstoque && (
            <TabsTrigger value="estoque" className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              Estoque
            </TabsTrigger>
          )}
          {showConta && (
            <TabsTrigger value="conta" className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Conta da obra
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="timeline">
          <ObraTimelineTab obra={obra} onIrParaDiario={() => setTab("diario")} />
        </TabsContent>
        {showDiario && (
          <TabsContent value="diario">
            <ObraDiarioTab obraId={obra.id} canEdit={canEdit} />
          </TabsContent>
        )}
        {showCronograma && (
          <TabsContent value="cronograma">
            <ObraCronogramaTab obraId={obra.id} projetoId={obra.projeto_id} canEdit={canEdit} />
          </TabsContent>
        )}
        {showCotacoes && (
          <TabsContent value="cotacoes">
            <ObraCotacoesTab obraId={obra.id} canEdit={canEdit} />
          </TabsContent>
        )}
        {showEstoque && (
          <TabsContent value="estoque">
            <ObraEstoqueTab obraId={obra.id} canEdit={canEdit} />
          </TabsContent>
        )}
        {showConta && (
          <TabsContent value="conta">
            <ObraContaTab obra={obra} canEdit={canEdit} />
          </TabsContent>
        )}
      </Tabs>

      <ObraFormDialog open={editOpen} onOpenChange={setEditOpen} obra={obra} />

      <CriarAcessoCampoDialog open={acessoCampoOpen} onOpenChange={setAcessoCampoOpen} obraId={obra.id} />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        onConfirm={handleDelete}
        title="Excluir obra?"
        itemName={obra.nome}
        description="A obra sai da lista. O projeto e o financeiro não são afetados."
        variant="destructive"
        confirmText="Excluir"
        loading={del.isPending}
      />
    </PageLayout>
  );
}
