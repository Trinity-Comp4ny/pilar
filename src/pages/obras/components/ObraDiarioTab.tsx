import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/format";
import { climaLabel, condicaoLabel, tipoImpedimentoLabel } from "@/lib/obras";
import { useObraRdos, useDeleteRdo, type RdoRow } from "@/hooks/useObraRdo";
import { useObraRdoTarefas, type ResultadoRdoTarefa } from "@/hooks/useObraRdoTarefas";
import { useObraFotos } from "@/hooks/useObraFotos";
import { useObraMedicoes } from "@/hooks/useObraMedicoes";
import { useObraRdoEfetivo } from "@/hooks/useObraRdoEfetivo";
import { useObraRdoImpedimentos } from "@/hooks/useObraRdoImpedimentos";
import { useObraRdoVisitas } from "@/hooks/useObraRdoVisitas";
import { RdoFormDialog } from "./RdoFormDialog";
import { RdoFeedCard } from "./RdoFeedCard";

const RESULTADO_LABEL: Record<ResultadoRdoTarefa, string> = {
  avancou: "Avançou",
  concluiu: "Concluiu",
  parou: "Parou",
};
const RESULTADO_TONE: Record<ResultadoRdoTarefa, string> = {
  avancou: "bg-info-soft text-info-mid",
  concluiu: "bg-positive/15 text-positive-strong",
  parou: "bg-warning-soft text-warning-strong",
};

function Campo({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="whitespace-pre-wrap text-sm text-ink/90">{texto}</p>
    </div>
  );
}

export function ObraDiarioTab({ obraId, canEdit }: { obraId: string; canEdit: boolean }) {
  const { data: rdos = [], isLoading } = useObraRdos(obraId);
  const { data: vinculos = [] } = useObraRdoTarefas(obraId);
  const { data: fotosPorRdo = {} } = useObraFotos(obraId);
  const { data: medicoesPorRdo = {} } = useObraMedicoes(obraId);
  const { data: efetivos = [] } = useObraRdoEfetivo(obraId);
  const { data: impedimentos = [] } = useObraRdoImpedimentos(obraId);
  const { data: visitas = [] } = useObraRdoVisitas(obraId);
  const del = useDeleteRdo(obraId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RdoRow | null>(null);
  const [confirm, setConfirm] = useState<RdoRow | null>(null);
  // Feed visual (spec 087) além da lista densa já existente — não persiste
  // entre sessões, reseta pro padrão a cada entrada na aba.
  const [visualizacao, setVisualizacao] = useState<"lista" | "feed">("lista");

  const abrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const abrirEdicao = (rdo: RdoRow) => {
    setEditing(rdo);
    setDialogOpen(true);
  };

  const remover = async () => {
    if (!confirm) return;
    try {
      await del.mutateAsync(confirm.id);
      toast.success("Registro removido");
      setConfirm(null);
    } catch (e) {
      toast.error("Não foi possível remover", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setVisualizacao("lista")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              visualizacao === "lista" ? "bg-white text-ink shadow-sm" : "text-muted-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao("feed")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              visualizacao === "feed" ? "bg-white text-ink shadow-sm" : "text-muted-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Feed
          </button>
        </div>
        {canEdit && (
          <Button variant="brand" size="sm" onClick={abrirNovo}>
            <Plus className="mr-1.5 h-4 w-4" />
            Registrar dia
          </Button>
        )}
      </div>

      {rdos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Diário vazio"
          description="Registre o que aconteceu na obra: clima, efetivo, atividades e pendências."
          action={canEdit ? { label: "Registrar dia", onClick: abrirNovo } : undefined}
        />
      ) : visualizacao === "feed" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rdos.map((r) => {
            const nTarefas = vinculos.filter((v) => v.rdo_id === r.id).length;
            const nEfetivo = efetivos.filter((e) => e.rdo_id === r.id).length;
            const nImpedimentos = impedimentos.filter((i) => i.rdo_id === r.id).length;
            const nVisitas = visitas.filter((v) => v.rdo_id === r.id).length;
            const badges = [
              nTarefas > 0 && `${nTarefas} tarefa${nTarefas > 1 ? "s" : ""}`,
              nEfetivo > 0 && `${nEfetivo} equipe${nEfetivo > 1 ? "s" : ""}`,
              nImpedimentos > 0 && `⚠ ${nImpedimentos} impedimento${nImpedimentos > 1 ? "s" : ""}`,
              nVisitas > 0 && `${nVisitas} visita${nVisitas > 1 ? "s" : ""}`,
            ].filter(Boolean) as string[];
            return (
              <RdoFeedCard
                key={r.id}
                data={r.data}
                clima={r.clima}
                atividades={r.atividades}
                ocorrencias={r.ocorrencias}
                fotos={fotosPorRdo[r.id] ?? []}
                onClick={canEdit ? () => abrirEdicao(r) : undefined}
                extra={
                  badges.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 border-t border-black/5 pt-2 text-[11px] text-muted-foreground">
                      {badges.map((b) => (
                        <span key={b}>{b}</span>
                      ))}
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {rdos.map((r) => (
            <Card key={r.id} className="rounded-2xl border border-black/5 bg-white">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      {formatDate(r.data)}
                    </span>
                    {r.clima && <span className="text-muted-foreground">{climaLabel(r.clima)}</span>}
                    {r.condicao_trabalho && (
                      <span className="text-muted-foreground">{condicaoLabel(r.condicao_trabalho)}</span>
                    )}
                    {r.efetivo != null && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {r.efetivo}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirm(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {(() => {
                  const doDia = vinculos.filter((v) => v.rdo_id === r.id);
                  if (doDia.length === 0) return null;
                  return (
                    <div className="space-y-1.5 border-t border-black/5 pt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tarefas</p>
                      {doDia.map((v) => (
                        <div key={v.id} className="flex items-start gap-2 text-sm">
                          <span
                            className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${RESULTADO_TONE[v.resultado]}`}
                          >
                            {RESULTADO_LABEL[v.resultado]}
                          </span>
                          <span className="min-w-0 text-ink/90">
                            {v.tarefa?.titulo ?? "Tarefa removida"}
                            {v.observacao && <span className="text-muted-foreground"> — {v.observacao}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {(() => {
                  const doDia = efetivos.filter((e) => e.rdo_id === r.id);
                  if (doDia.length === 0) return null;
                  return (
                    <div className="space-y-1.5 border-t border-black/5 pt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Efetivo por fornecedor
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {doDia.map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-ink/90"
                          >
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {e.fornecedor?.nome ?? e.fornecedor_nome ?? "Sem nome"}: {e.quantidade}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const doDia = impedimentos.filter((i) => i.rdo_id === r.id);
                  if (doDia.length === 0) return null;
                  return (
                    <div className="space-y-1.5 rounded-lg border border-warning-mid-border bg-warning-soft p-2.5">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-warning-strong">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Impedimentos
                      </p>
                      {doDia.map((i) => (
                        <p key={i.id} className="text-sm text-ink/90">
                          <span className="font-medium">{tipoImpedimentoLabel(i.tipo)}:</span> {i.descricao}
                        </p>
                      ))}
                    </div>
                  );
                })()}

                {(() => {
                  const doDia = visitas.filter((v) => v.rdo_id === r.id);
                  if (doDia.length === 0) return null;
                  return (
                    <div className="space-y-1.5 border-t border-black/5 pt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Visitas</p>
                      {doDia.map((v) => (
                        <div key={v.id} className="flex items-start gap-2 text-sm">
                          <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 text-ink/90">
                            {v.fornecedor?.nome ?? v.fornecedor_nome ?? "Sem nome"}
                            {v.observacao && <span className="text-muted-foreground"> — {v.observacao}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {(r.atividades || r.ocorrencias || r.pendencias) && (
                  <div className="space-y-2 border-t border-black/5 pt-3">
                    <Campo titulo="Observações" texto={r.atividades} />
                    <Campo titulo="Ocorrências" texto={r.ocorrencias} />
                    <Campo titulo="Pendências" texto={r.pendencias} />
                  </div>
                )}

                {(fotosPorRdo[r.id]?.length ?? 0) > 0 && (
                  <div className="space-y-1.5 border-t border-black/5 pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Fotos</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {fotosPorRdo[r.id].map((f) => (
                        <a
                          key={f.id}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square overflow-hidden rounded-lg bg-muted"
                        >
                          <img src={f.url} alt="Foto da obra" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {(medicoesPorRdo[r.id]?.length ?? 0) > 0 && (
                  <div className="space-y-1.5 border-t border-black/5 pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Medição</p>
                    <div className="flex flex-wrap gap-1.5">
                      {medicoesPorRdo[r.id].map((m) => (
                        <span key={m.id} className="rounded-full bg-muted px-2.5 py-1 text-xs text-ink/90">
                          {m.item}: {m.quantidade} {m.unidade}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RdoFormDialog open={dialogOpen} onOpenChange={setDialogOpen} obraId={obraId} rdos={rdos} rdoInicial={editing} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        onConfirm={remover}
        title="Excluir registro?"
        itemName={confirm ? formatDate(confirm.data) : undefined}
        description="O registro do dia será removido do diário."
        variant="destructive"
        confirmText="Excluir"
        loading={del.isPending}
      />
    </div>
  );
}
