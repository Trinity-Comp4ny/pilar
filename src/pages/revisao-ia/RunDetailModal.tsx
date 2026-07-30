import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAgentRunDetail, type AgentAction } from "./useAgentRuns";
import { statusLabel, tipoLabel, toolLabel } from "./agentLabels";

function horaAction(a: AgentAction): string {
  return new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Detalhe curto do passo, extraído de result/args (shape varia). Vazio se nada útil.
function detalheAction(a: AgentAction): string {
  const fonte = (a.result ?? a.args ?? {}) as Record<string, unknown>;
  const c = fonte.resumo ?? fonte.nome ?? fonte.descricao ?? fonte.titulo;
  return typeof c === "string" && c.trim() ? c : "";
}

/**
 * Modal com o raciocínio de um run: a timeline de `agent_actions`. Enquanto o run
 * está em andamento, o hook faz polling (2s) e novos passos aparecem sozinhos
 * (Fase 2a). Ver spec 007. Aberto quando `runId` não é nulo.
 */
export function RunDetailModal({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const { data, isLoading } = useAgentRunDetail(runId);
  const run = data?.run;
  const actions = data?.actions ?? [];
  const emAndamento = run?.status === "queued" || run?.status === "running";

  return (
    <Dialog open={runId !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-w-[min(100vw-2rem,640px)]">
        <DialogHeader>
          <DialogTitle>{run ? tipoLabel(run.agent_type) : "Detalhe"}</DialogTitle>
          {run && (
            <p className="text-sm text-ink-muted">
              {statusLabel(run.status)}
              {" · "}
              {new Date(run.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </DialogHeader>

        <div className="mt-1">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-3">
            Raciocínio dos agentes
          </h3>

          {isLoading && !data ? (
            <p className="text-sm text-ink-muted">Carregando…</p>
          ) : actions.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {emAndamento ? "Os agentes estão começando…" : "Sem passos registrados para este item."}
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-black/10 pl-5">
              {actions.map((a) => {
                const detalhe = detalheAction(a);
                const falhou = a.tool_name.startsWith("transicao_status:failed");
                return (
                  <li key={a.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[1.42rem] top-1 grid h-3 w-3 place-items-center rounded-full ring-2 ring-white",
                        falhou ? "bg-negative" : "bg-positive"
                      )}
                    />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-ink">{toolLabel(a.tool_name)}</span>
                      <span className="text-[11px] tabular-nums text-ink-muted shrink-0">{horaAction(a)}</span>
                    </div>
                    {detalhe && <p className="mt-0.5 text-xs text-ink-soft">{detalhe}</p>}
                  </li>
                );
              })}
            </ol>
          )}

          {emAndamento && (
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 size={14} className="animate-spin" />
              Agentes trabalhando…
            </p>
          )}

          {run?.status === "failed" && run.error && (
            <p className="mt-4 flex items-start gap-2 text-sm text-negative-strong">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {run.error}
            </p>
          )}

          {(run?.status === "executed" || run?.status === "approved") && (
            <p className="mt-4 flex items-center gap-2 text-sm text-positive-strong">
              <CheckCircle2 size={14} />
              Concluído pelos agentes.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
