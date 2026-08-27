import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useNotificacoes, useMarcarLida, type Notificacao } from "@/hooks/useNotificacoes";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";
import {
  useAgentRunsFeed,
  useAprovarOrcamento,
  useRejeitarRun,
  type AgentRun,
  type OrcamentoResult,
} from "./useAgentRuns";
import { RunDetailModal } from "./RunDetailModal";
import { tipoLabel } from "./agentLabels";

// Resumo curto do que o run produziu, extraído do result (shape varia por tipo).
function resumoRun(run: AgentRun): string {
  const r = (run.result ?? {}) as Record<string, unknown>;
  const candidato = r.resumo ?? r.nome ?? r.descricao ?? r.titulo ?? r.razao_social;
  if (typeof candidato === "string" && candidato.trim()) return candidato;
  // Consulta: o resumo é a própria pergunta (guardada em input.message).
  const inp = (run.input ?? {}) as Record<string, unknown>;
  if (typeof inp.message === "string" && inp.message.trim()) return inp.message;
  return run.entity_type ? `Referente a ${run.entity_type}` : "";
}

function dataRun(run: AgentRun): string {
  return new Date(run.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Estados do agent_runs agrupados no que o usuário entende.
type Grupo = "precisa" | "andamento" | "concluido" | "arquivado";
function grupoDoStatus(status: string): Grupo {
  if (status === "pending_review") return "precisa";
  if (status === "queued" || status === "running") return "andamento";
  if (status === "approved" || status === "executed") return "concluido";
  return "arquivado"; // rejected, failed
}

function parseOrcamento(run: AgentRun): OrcamentoResult | null {
  const result = run.result as unknown as OrcamentoResult | null;
  if (!result || !Array.isArray(result.fases)) return null;
  return result;
}

/** Card de orçamento com aprovação inline (materializa as fases no projeto). */
function OrcamentoCard({ run, onAbrir }: { run: AgentRun; onAbrir: (id: string) => void }) {
  const aprovar = useAprovarOrcamento();
  const rejeitar = useRejeitarRun();
  const orcamento = parseOrcamento(run);

  if (!orcamento) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-ink-muted">
          Draft em formato não reconhecido (run {run.id.slice(0, 8)}).
        </CardContent>
      </Card>
    );
  }

  const semProjeto = !run.entity_id;
  const totalVenda = orcamento.fases.reduce(
    (sum, f) => sum + Math.round(f.horas_estimadas * f.custo_hora * (1 + f.margem_alvo_pct / 100) * 100) / 100,
    0
  );

  const handleAprovar = () => {
    aprovar.mutate(run.id, {
      onSuccess: () => toast.success("Orçamento aprovado", { description: "As fases foram criadas no projeto." }),
      onError: (e) => toast.error("Erro ao aprovar", { description: e instanceof Error ? e.message : undefined }),
    });
  };

  const handleRejeitar = () => {
    rejeitar.mutate(run.id, {
      onSuccess: () => toast.info("Draft rejeitado"),
      onError: (e) => toast.error("Erro ao rejeitar", { description: e instanceof Error ? e.message : undefined }),
    });
  };

  const loading = aprovar.isPending || rejeitar.isPending;

  return (
    <Card className="border-black/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-ink" />
              {tipoLabel(run.agent_type)}
            </CardTitle>
            <p className="text-sm text-ink-soft">{orcamento.resumo}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Clock className="h-3 w-3" /> Aguardando você
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contexto: o que é e o que a decisão faz (feedback do dono: "não entendi o que aprovar"). */}
        <p className="rounded-lg bg-brand/10 px-3 py-2 text-[13px] text-ink-soft">
          Um agente montou este orçamento a partir do briefing do projeto. Revise horas, custo e margem de cada
          disciplina. <span className="text-ink">Aprovar</span> grava estas fases no orçamento do projeto;{" "}
          <span className="text-ink">Rejeitar</span> descarta o rascunho.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Disciplina</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Custo/h</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orcamento.fases.map((f, i) => {
              const valor = Math.round(f.horas_estimadas * f.custo_hora * (1 + f.margem_alvo_pct / 100) * 100) / 100;
              return (
                <TableRow key={i}>
                  <TableCell className="font-medium">{f.disciplina}</TableCell>
                  <TableCell className="text-right">{f.horas_estimadas}h</TableCell>
                  <TableCell className="text-right">{formatCurrency(f.custo_hora)}</TableCell>
                  <TableCell className="text-right">{f.margem_alvo_pct}%</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(valor)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">Total estimado</span>
          <span className="font-semibold text-base">{formatCurrency(totalVenda)}</span>
        </div>

        {orcamento.perguntas_faltantes && orcamento.perguntas_faltantes.length > 0 && (
          <div className="rounded-md bg-black/[0.03] p-3 text-sm">
            <p className="font-medium mb-1">Perguntas para refinar:</p>
            <ul className="list-disc pl-4 text-ink-soft space-y-0.5">
              {orcamento.perguntas_faltantes.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {semProjeto && (
          <p className="text-sm text-negative-strong">
            Este draft não está associado a um projeto — associe um projeto antes de aprovar.
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="brand"
            onClick={handleAprovar}
            disabled={loading || semProjeto}
            className="gap-2 rounded-full"
          >
            {aprovar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprovar
          </Button>
          <Button variant="ghost" onClick={handleRejeitar} disabled={loading} className="gap-2 rounded-full">
            {rejeitar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Rejeitar
          </Button>
          <Button variant="ghost" onClick={() => onAbrir(run.id)} className="ml-auto gap-2 rounded-full text-ink-soft">
            <Sparkles className="h-4 w-4" />
            Ver raciocínio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Linha compacta para um run (tipos sem aprovação inline, ou estados concluído/arquivado). */
function RunRow({ run, onAbrir }: { run: AgentRun; onAbrir: (id: string) => void }) {
  const grupo = grupoDoStatus(run.status);
  const resumo = resumoRun(run);

  const icone =
    grupo === "andamento" ? (
      <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-ink-muted" />
    ) : grupo === "concluido" ? (
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive-strong" />
    ) : run.status === "failed" ? (
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-negative-strong" />
    ) : grupo === "precisa" ? (
      <Clock size={16} className="mt-0.5 shrink-0 text-ink-soft" />
    ) : (
      <X size={16} className="mt-0.5 shrink-0 text-ink-muted" />
    );

  return (
    <button
      type="button"
      onClick={() => onAbrir(run.id)}
      className="w-full flex items-start gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-left hover:bg-black/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {icone}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink truncate">{tipoLabel(run.agent_type)}</span>
          <span className="text-[11px] text-ink-muted shrink-0 ml-auto">{dataRun(run)}</span>
        </div>
        {resumo && <p className="mt-0.5 text-xs text-ink-soft truncate">{resumo}</p>}
        {grupo === "precisa" && (
          <p className="mt-1 text-xs text-ink-muted">Confirme este item na conversa para gravar.</p>
        )}
        {run.status === "failed" && run.error && (
          <p className="mt-1 text-xs text-negative-strong truncate">{run.error}</p>
        )}
      </div>
      <Sparkles size={13} className="mt-1 shrink-0 text-ink-muted" />
    </button>
  );
}

function GrupoHeader({ titulo, count, expansivel = false }: { titulo: string; count: number; expansivel?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      {expansivel && <ChevronRight size={13} className="text-ink-muted transition-transform group-open:rotate-90" />}
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">{titulo}</h3>
      <span className="text-[11px] text-ink-muted">{count}</span>
    </div>
  );
}

// Categoria de uma notificação para o Panorama (agrega o que o sócio confia).
// Vocabulário de tipos é o de gerar_notificacoes_ambient() (spec 029/067) —
// substitui o de alertas/gerar_alertas_ambient(), dormente desde 17/08.
function categoriaAlerta(tipo: string): "vencido" | "aVencer" | "prazo" | "preencher" | "outro" {
  if (tipo === "pagamento_atrasado" || tipo === "recebimento_atrasado") return "vencido";
  if (tipo === "vencimento_proximo" || tipo === "marco_proximo") return "aVencer";
  if (tipo === "projeto_prazo_proximo" || tipo === "disciplina_prazo_proximo") return "aVencer";
  if (tipo === "projeto_atrasado" || tipo === "disciplina_atrasada" || tipo === "obra_passo_atrasado") return "prazo";
  if (tipo === "custo_nao_lancado") return "preencher";
  return "outro";
}

/** Card do Panorama: um número-chave do dia (label + valor), destacado se exige atenção. */
function PanoramaCard({ label, value, alerta }: { label: string; value: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <span className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      <span
        className={cn("mt-1.5 block text-xl font-semibold tabular-nums", alerta ? "text-negative-strong" : "text-ink")}
      >
        {value}
      </span>
    </div>
  );
}

const ALERTA_CRITICO = new Set(["critical", "high"]);

/**
 * Achado do agente ambient (spec 029/067): item da tabela `notificacoes` gerado pela
 * varredura determinística (vencidos, prazos, atrasos, escopo estourado). Clicar
 * abre o `link` gravado na origem; "Resolver" marca como lida (some da lista).
 */
function AlertaCard({
  alerta,
  onAbrir,
  onResolver,
  resolvendo,
}: {
  alerta: Notificacao;
  onAbrir: (rota: string) => void;
  onResolver: (id: string) => void;
  resolvendo: boolean;
}) {
  const critico = ALERTA_CRITICO.has(alerta.severidade);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          size={16}
          className={cn("mt-0.5 shrink-0", critico ? "text-negative-strong" : "text-ink-soft")}
        />
        <span className="text-sm font-medium text-ink">{alerta.titulo}</span>
      </div>
      {alerta.mensagem && <p className="mt-1.5 flex-1 text-xs text-ink-soft">{alerta.mensagem}</p>}
      <div className="mt-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onAbrir(alerta.link ?? "/inicio")}
          className="rounded-full px-2.5 py-1 text-xs text-ink-soft hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Abrir
        </button>
        <button
          type="button"
          onClick={() => onResolver(alerta.id)}
          disabled={resolvendo}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-muted hover:bg-black/5 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Check size={13} /> Resolver
        </button>
      </div>
    </div>
  );
}

/**
 * Mesa de trabalho dos agentes (spec 007): tudo que os agentes produziram num lugar.
 * No topo, os achados do agente AMBIENT (tabela `notificacoes`: vencidos, prazos,
 * atrasos, escopo estourado — gerados por varredura no servidor sem o usuário
 * pedir, spec 029/067). Abaixo, os runs do chat/copilots agrupados por estado, com
 * aprovação inline de orçamento. `enabled` desliga as queries para quem não pode
 * revisar (não-owner).
 */
export function RevisaoInbox({ enabled = true }: { enabled?: boolean }) {
  const { data: runs, isLoading } = useAgentRunsFeed({ enabled });
  const { data: alertas = [] } = useNotificacoes("inbox", 30);
  const marcarLido = useMarcarLida();
  const navigate = useNavigate();
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [vista, setVista] = useState<"acao" | "historico">("acao");
  const { data: dash } = useDashboardData(); // reusa o cache da Início (mesma queryKey)

  const alertasAbertos = alertas.filter((a) => !a.lido_em);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const runsList = runs ?? [];
  if (runsList.length === 0 && alertasAbertos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-10 w-10 text-ink-muted mb-3" />
          <p className="font-medium">Os agentes ainda não trouxeram nada</p>
          <p className="text-sm text-ink-muted mt-1">
            Assim que houver uma pendência, um vencimento ou um pedido seu, o trabalho dos agentes aparece aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  const precisa = runsList.filter((r) => grupoDoStatus(r.status) === "precisa");
  const andamento = runsList.filter((r) => grupoDoStatus(r.status) === "andamento");
  const concluido = runsList.filter((r) => grupoDoStatus(r.status) === "concluido");
  const arquivado = runsList.filter((r) => grupoDoStatus(r.status) === "arquivado");

  const renderItem = (run: AgentRun) =>
    run.agent_type === "orcamento_honorarios" && run.status === "pending_review" ? (
      <OrcamentoCard key={run.id} run={run} onAbrir={setDetalheId} />
    ) : (
      <RunRow key={run.id} run={run} onAbrir={setDetalheId} />
    );

  const temHistorico = concluido.length + arquivado.length > 0;
  const nadaEmAcao = alertasAbertos.length === 0 && precisa.length === 0 && andamento.length === 0;

  // Panorama: números-chave do dia. R$ vêm do dashboard (cache compartilhado); prazos, dos alertas.
  const venc = dash?.proximosVencimentos ?? [];
  const vencidoTotal = venc
    .filter((v) => v.status === "pendente" && v.diasRestantes < 0)
    .reduce((s, v) => s + v.valor, 0);
  const aVencer7 = venc
    .filter((v) => v.status === "pendente" && v.diasRestantes >= 0 && v.diasRestantes <= 7)
    .reduce((s, v) => s + v.valor, 0);
  const prazosEstourados = alertasAbertos.filter((a) => categoriaAlerta(a.tipo) === "prazo").length;

  return (
    <div className="space-y-6">
      {/* Panorama: os números do dia, largura total. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PanoramaCard label="Esperando decisão" value={String(precisa.length)} alerta={precisa.length > 0} />
        <PanoramaCard label="Vencido" value={formatCurrency(vencidoTotal)} alerta={vencidoTotal > 0} />
        <PanoramaCard label="Vence em 7 dias" value={formatCurrency(aVencer7)} />
        <PanoramaCard label="Prazos estourados" value={String(prazosEstourados)} alerta={prazosEstourados > 0} />
      </div>

      <div className="space-y-6">
        {/* Sub-toggle: separa o que exige ação do histórico (dor: concluído/arquivado empurravam tudo). */}
        {temHistorico && (
          <div className="inline-flex rounded-full bg-black/5 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setVista("acao")}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                vista === "acao" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              Precisa de você
            </button>
            <button
              type="button"
              onClick={() => setVista("historico")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors",
                vista === "historico" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              Histórico
              <span className="text-[10px] text-ink-muted">{concluido.length + arquivado.length}</span>
            </button>
          </div>
        )}

        {vista === "acao" ? (
          <div className="space-y-8">
            {alertasAbertos.length > 0 && (
              <section aria-label="Radar do agente">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Bell size={13} className="text-ink-muted" />
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                    Radar do agente
                  </h3>
                  <span className="text-[11px] text-ink-muted">{alertasAbertos.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {alertasAbertos.map((a) => (
                    <AlertaCard
                      key={a.id}
                      alerta={a}
                      onAbrir={(rota) => navigate(rota)}
                      onResolver={(id) => marcarLido.mutate(id)}
                      resolvendo={marcarLido.isPending}
                    />
                  ))}
                </div>
              </section>
            )}

            {precisa.length > 0 && (
              <section aria-label="Precisa de você">
                <GrupoHeader titulo="Precisa de você" count={precisa.length} />
                <div className="space-y-3">{precisa.map(renderItem)}</div>
              </section>
            )}

            {andamento.length > 0 && (
              <section aria-label="Em andamento">
                <GrupoHeader titulo="Em andamento" count={andamento.length} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{andamento.map(renderItem)}</div>
              </section>
            )}

            {nadaEmAcao && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-positive/40 bg-positive/5 px-5 py-4 text-sm text-ink-soft">
                <CheckCircle2 size={16} className="text-positive-strong shrink-0" />
                Nada precisa de você agora. Os agentes seguem varrendo e avisam aqui.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {concluido.length > 0 && (
              <section aria-label="Concluído">
                <GrupoHeader titulo="Concluído" count={concluido.length} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{concluido.map(renderItem)}</div>
              </section>
            )}
            {arquivado.length > 0 && (
              <section aria-label="Arquivado">
                <GrupoHeader titulo="Arquivado" count={arquivado.length} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{arquivado.map(renderItem)}</div>
              </section>
            )}
          </div>
        )}
      </div>

      <RunDetailModal runId={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}
