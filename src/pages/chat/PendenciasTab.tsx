import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Clock, Inbox, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AditivoReviewCard } from "@/components/AditivoReviewCard";
import {
  usePendenciasAgentes,
  useAprovarEscopo,
  useRejeitarEscopo,
  useAdiarEscopo,
  type PendenciaAditivo,
} from "@/hooks/useEscopos";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAgentHeartbeat } from "@/pages/chat/hooks/useAgentHeartbeat";
import {
  type Pendencia,
  type PendenciaArea,
  useAdiarPendencia,
  useAgentePendencias,
  useDispensarPendencia,
} from "@/pages/chat/hooks/useAgentePendencias";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CobrancaDrawer } from "./CobrancaDrawer";
import { OrcamentoDrawer } from "./OrcamentoDrawer";
import { PrazoDrawer } from "./PrazoDrawer";
import { PendenciaCard } from "./PendenciaCard";
import { AREAS, agrupar, contarPorArea, plural } from "./lib/pendencias";

const HEARTBEAT_STALE_HORAS = 30; // roda diariamente às 06:15 UTC; folga sobre 24h pra não alarmar à toa
const POR_GRUPO = 6;

/**
 * Aba "Pendências" de /agentes (SPEC 084, 146 e 148): tudo que o agente de acompanhamento encontra em
 * aberto, com a ação já preparada quando existe (cobrança por e-mail, aditivo), mais o que só pede
 * atenção. Cada item mostra idade, fatos da regra e a saída (revisar, abrir, adiar, dispensar).
 */
export function PendenciasTab() {
  const pendencias = useAgentePendencias();
  const aditivos = usePendenciasAgentes();
  const aprovar = useAprovarEscopo();
  const rejeitar = useRejeitarEscopo();
  const adiarEscopo = useAdiarEscopo();
  const adiar = useAdiarPendencia();
  const dispensar = useDispensarPendencia();
  const guardiao = useAgentHeartbeat("guardiao_margem_cron");
  const acompanhamento = useAgentHeartbeat("acompanhamento_cron");
  const { canEdit: podeEditarProjetos } = useFeatureAccess("projetos");
  const { canEdit: podeEditarFinanceiro } = useFeatureAccess("financeiro");

  const [area, setArea] = useState<PendenciaArea | null>(null);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [mostrarPlanejar, setMostrarPlanejar] = useState(false);
  const [emRevisao, setEmRevisao] = useState<Pendencia | null>(null);
  const [confirmAprovar, setConfirmAprovar] = useState<PendenciaAditivo | null>(null);
  const [confirmRejeitar, setConfirmRejeitar] = useState<PendenciaAditivo | null>(null);

  const lista = useMemo(() => pendencias.data ?? [], [pendencias.data]);
  const porArea = useMemo(() => contarPorArea(lista), [lista]);
  const visiveis = useMemo(() => (area ? lista.filter((p) => p.area === area) : lista), [lista, area]);
  const grupos = useMemo(() => agrupar(visiveis), [visiveis]);
  const itensAditivo = aditivos.data ?? [];
  const mostrarAditivos = !area || area === "orcamento";

  const semOrcamento = useMemo(() => lista.filter((p) => p.tipo === "orcamento_ausente"), [lista]);
  const guardiaoDados = guardiao.data;
  const guardiaoParado =
    !guardiao.isLoading &&
    (!guardiaoDados || Date.now() - new Date(guardiaoDados.last_run_at).getTime() > HEARTBEAT_STALE_HORAS * 3_600_000);

  const total = lista.length + itensAditivo.length;
  const prontos = grupos.prontas.length + (mostrarAditivos ? itensAditivo.length : 0);

  const handleAdiar = async (p: Pendencia, dias: number) => {
    try {
      await adiar.mutateAsync({ id: p.id, dias });
      toast.success(`Adiado por ${plural(dias, "dia", "dias")}`, { description: "Volta a aparecer nessa data." });
    } catch {
      toast.error("Não foi possível adiar", { description: "Atualize a lista e tente de novo." });
    }
  };

  const handleDispensar = async (p: Pendencia) => {
    try {
      await dispensar.mutateAsync(p.id);
      toast.success("Pendência dispensada", { description: "Ela some enquanto a condição existir." });
    } catch {
      toast.error("Não foi possível dispensar", { description: "Atualize a lista e tente de novo." });
    }
  };

  const handleAdiarAditivo = async (escopoId: string, dias: number) => {
    try {
      await adiarEscopo.mutateAsync({ escopoId, dias });
      toast.success(dias === 1 ? "Adiado por 1 dia" : `Adiado por ${dias} dias`);
    } catch {
      toast.error("Não foi possível adiar");
    }
  };

  const handleAprovar = async () => {
    if (!confirmAprovar) return;
    try {
      await aprovar.mutateAsync({ escopoId: confirmAprovar.id, projetoId: confirmAprovar.projeto_id });
      toast.success("Aditivo aprovado: contrato e orçamento atualizados");
      setConfirmAprovar(null);
    } catch {
      toast.error("Não foi possível aprovar o aditivo");
    }
  };

  const handleRejeitar = async () => {
    if (!confirmRejeitar) return;
    try {
      await rejeitar.mutateAsync({ escopoId: confirmRejeitar.id, projetoId: confirmRejeitar.projeto_id });
      toast.success("Aditivo rejeitado");
      setConfirmRejeitar(null);
    } catch {
      toast.error("Não foi possível rejeitar o aditivo");
    }
  };

  if (pendencias.isLoading || aditivos.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const renderGrupo = (id: string, titulo: string, nota: string, itens: Pendencia[]) => {
    if (itens.length === 0) return null;
    const aberto = expandidos[id] ?? false;
    const lote = aberto ? itens : itens.slice(0, POR_GRUPO);
    return (
      <section aria-labelledby={`grupo-${id}`} className="space-y-2">
        <h2
          id={`grupo-${id}`}
          className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {titulo}
          <span className="text-xs font-normal normal-case tracking-normal">{nota}</span>
        </h2>
        {lote.map((p) => (
          <PendenciaCard
            key={p.id}
            pendencia={p}
            onRevisar={setEmRevisao}
            onAdiar={handleAdiar}
            onDispensar={handleDispensar}
          />
        ))}
        {itens.length > POR_GRUPO && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setExpandidos((e) => ({ ...e, [id]: !aberto }))}
          >
            {aberto ? "Mostrar menos" : `Mostrar mais ${itens.length - POR_GRUPO}`}
          </Button>
        )}
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Fila atualizada ao abrir esta aba
          {acompanhamento.data && ` · rotina diária em ${formatDateTime(acompanhamento.data.last_run_at)}`}
        </span>
        <span>Nada é enviado sem a sua aprovação</span>
      </div>

      {pendencias.isError && (
        <div className="rounded-xl border border-danger-mid-border bg-danger-soft p-3 text-sm text-danger-strong">
          <p>
            <strong>Não foi possível atualizar as pendências.</strong> Os itens abaixo são da última atualização
            bem-sucedida.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => pendencias.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {guardiaoParado && (
        <div className="flex items-start gap-2 rounded-xl border border-warning-mid-border bg-warning-soft p-3 text-sm text-warning-strong">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Guardião de margem sem sinal de execução recente: pode estar com problema, não necessariamente "nenhum
            projeto estourou". Se persistir, avise o suporte.
          </p>
        </div>
      )}

      {semOrcamento.length > 0 && (
        <div className="rounded-xl border bg-muted/40 p-3 text-sm text-foreground">
          <p>
            {semOrcamento.length === 1
              ? "1 projeto em andamento está sem orçamento por disciplina."
              : `${semOrcamento.length} projetos em andamento estão sem orçamento por disciplina.`}{" "}
            O guardião de margem só vigia projeto com orçamento. Defina o orçamento na aba Escopo do projeto.
          </p>
          {semOrcamento[0].link && (
            <NavLink
              to={semOrcamento[0].link}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium underline"
            >
              Definir orçamento <ArrowUpRight className="h-3 w-3" />
            </NavLink>
          )}
        </div>
      )}

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nada esperando você agora</p>
            <p className="text-sm text-muted-foreground">
              O acompanhamento confere parcelas, prazos, orçamento e obras todos os dias. Quando algo vencer ou atrasar,
              o agente já deixa o próximo passo preparado aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Resumo das pendências">
            <div className="rounded-xl border border-brand bg-surface-card p-3">
              <p className="text-xl font-semibold tabular-nums text-foreground">{prontos}</p>
              <p className="text-xs text-muted-foreground">Prontos para aprovar</p>
            </div>
            <div className="rounded-xl border bg-surface-card p-3">
              <p className="text-xl font-semibold tabular-nums text-danger-strong">{grupos.urgentes.length}</p>
              <p className="text-xs text-muted-foreground">Urgentes</p>
            </div>
            <div className="rounded-xl border bg-surface-card p-3">
              <p className="text-xl font-semibold tabular-nums text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground">Em aberto</p>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar por área">
            <Button variant={area === null ? "default" : "outline"} size="sm" onClick={() => setArea(null)}>
              Todas <span className="ml-1 opacity-70">{total}</span>
            </Button>
            {AREAS.filter((a) => porArea[a.key] > 0).map((a) => (
              <Button
                key={a.key}
                variant={area === a.key ? "default" : "outline"}
                size="sm"
                aria-pressed={area === a.key}
                onClick={() => setArea(area === a.key ? null : a.key)}
              >
                {a.label} <span className="ml-1 opacity-70">{porArea[a.key]}</span>
              </Button>
            ))}
          </div>

          {(grupos.prontas.length > 0 || (mostrarAditivos && itensAditivo.length > 0)) && (
            <section aria-labelledby="grupo-prontas" className="space-y-2">
              <h2
                id="grupo-prontas"
                className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Prontos para você aprovar
                <span className="text-xs font-normal normal-case tracking-normal">
                  o agente já preparou o próximo passo
                </span>
              </h2>
              {mostrarAditivos &&
                itensAditivo.map((escopo) => (
                  <div key={escopo.id} className="space-y-1.5">
                    <AditivoReviewCard
                      escopo={escopo}
                      canEdit={podeEditarProjetos}
                      projetoNome={escopo.projeto_nome}
                      onAprovar={() => setConfirmAprovar(escopo)}
                      onRejeitar={() => setConfirmRejeitar(escopo)}
                    />
                    <div className="flex items-center justify-between pl-1">
                      <NavLink
                        to={`/projetos/${escopo.projeto_id}#escopo`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Ver na aba Escopo do projeto <ArrowUpRight className="h-3 w-3" />
                      </NavLink>
                      {podeEditarProjetos && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" /> Adiar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAdiarAditivo(escopo.id, 3)}>
                              Por 3 dias
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAdiarAditivo(escopo.id, 7)}>
                              Por 1 semana
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              {grupos.prontas.map((p) => (
                <PendenciaCard
                  key={p.id}
                  pendencia={p}
                  onRevisar={setEmRevisao}
                  onAdiar={handleAdiar}
                  onDispensar={handleDispensar}
                />
              ))}
            </section>
          )}

          {renderGrupo("urgentes", "Urgente", "sem ação preparada", grupos.urgentes)}
          {renderGrupo("semana", "Esta semana", plural(grupos.semana.length, "item", "itens"), grupos.semana)}

          {grupos.planejar.length > 0 && (
            <section aria-labelledby="grupo-planejar" className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-surface-card p-3 text-sm">
                <h2 id="grupo-planejar" className="font-normal text-ink-soft">
                  <strong className="font-semibold text-foreground">Para planejar</strong> ·{" "}
                  {plural(grupos.planejar.length, "item", "itens")} de baixa urgência
                </h2>
                <Button variant="outline" size="sm" onClick={() => setMostrarPlanejar((v) => !v)}>
                  {mostrarPlanejar ? "Recolher" : "Ver"}
                </Button>
              </div>
              {mostrarPlanejar &&
                grupos.planejar.map((p) => (
                  <PendenciaCard
                    key={p.id}
                    pendencia={p}
                    onRevisar={setEmRevisao}
                    onAdiar={handleAdiar}
                    onDispensar={handleDispensar}
                  />
                ))}
            </section>
          )}

          {visiveis.length === 0 && (!mostrarAditivos || itensAditivo.length === 0) && (
            <p className={cn("rounded-xl border bg-surface-card p-4 text-center text-sm text-muted-foreground")}>
              Nada em aberto nessa área.
            </p>
          )}
        </>
      )}

      <CobrancaDrawer
        pendencia={emRevisao?.tipo === "cobranca_pronta" ? emRevisao : null}
        onOpenChange={(aberto) => !aberto && setEmRevisao(null)}
        canEdit={podeEditarFinanceiro}
      />
      <OrcamentoDrawer
        pendencia={emRevisao?.tipo === "orcamento_ausente" ? emRevisao : null}
        onOpenChange={(aberto) => !aberto && setEmRevisao(null)}
      />
      <PrazoDrawer
        key={emRevisao?.id}
        pendencia={emRevisao?.tipo === "projeto_prazo_proximo" ? emRevisao : null}
        onOpenChange={(aberto) => !aberto && setEmRevisao(null)}
        canEdit={podeEditarProjetos}
      />

      <ConfirmDialog
        open={!!confirmAprovar}
        onOpenChange={(open) => !open && setConfirmAprovar(null)}
        onConfirm={handleAprovar}
        title="Aprovar aditivo"
        itemName={confirmAprovar?.descricao}
        description="O valor entra no contrato do projeto e no orçamento vivo imediatamente. Esta ação não pode ser desfeita pela tela."
        confirmText="Aprovar"
        variant="default"
        loading={aprovar.isPending}
      />
      <ConfirmDialog
        open={!!confirmRejeitar}
        onOpenChange={(open) => !open && setConfirmRejeitar(null)}
        onConfirm={handleRejeitar}
        title="Rejeitar aditivo"
        itemName={confirmRejeitar?.descricao}
        description="O rascunho é descartado. Contrato e orçamento não são alterados."
        confirmText="Rejeitar"
        variant="destructive"
        loading={rejeitar.isPending}
      />
    </div>
  );
}
