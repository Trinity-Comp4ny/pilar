import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { quandoRelativo } from "../../lib";
import type { OpsExecucao } from "../api";

const STATUS: Record<string, string> = {
  rodando: "rodando",
  ok: "ok",
  falhou: "falhou",
  pausada_teto: "parou no teto de custo",
};

/** Últimas execuções do agente: quando, quem disparou, como terminou e quanto custou. */
export function ExecucoesAgente({
  execucoes,
  formatarCusto,
}: {
  execucoes: OpsExecucao[];
  formatarCusto: (usd: number) => string;
}) {
  return (
    <Card className="border border-black/5">
      <CardHeader className="pb-1">
        <CardTitle className="text-base">Execuções</CardTitle>
      </CardHeader>
      <CardContent>
        {execucoes.length === 0 ? (
          <EmptyState compact title="Nenhuma execução nos últimos 30 dias." />
        ) : (
          <ul className="divide-y divide-black/5 text-sm">
            {execucoes.slice(0, 10).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                <span className="text-ink">
                  {quandoRelativo(e.inicio) ?? "agora há pouco"}
                  <span className="text-ink-muted"> · {e.gatilho === "cron" ? "automático" : "você rodou"}</span>
                </span>
                <span className={e.status === "falhou" ? "text-danger-strong" : "text-ink-soft"}>
                  {STATUS[e.status] ?? e.status}
                  {e.custo_usd ? ` · ${formatarCusto(Number(e.custo_usd))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
