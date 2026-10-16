import { Pause, Play, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { quandoRelativo } from "../../lib";
import type { OpsAgente, OpsExecucao } from "../api";
import { useDefinirAgenteAtivo, useRodarAgente } from "../hooks";
import { cadenciaLegivel, ehExecutavel, PLANO_DOS_AGENTES, type AgenteId, type StatusAgente } from "../lib";

const NIVEL: Record<string, string> = {
  N0: "só observa",
  N1: "você aprova",
  N2: "faz e avisa",
  N3: "autônomo",
};

const TIPO: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  tarefa: "Tarefa",
  issue: "Issue",
  conteudo: "Conteúdo",
};

function linhaExecucao(agente: OpsAgente, status: StatusAgente, ultima: OpsExecucao | null): string {
  if (status === "so_numeros") return "Números do banco, atualizados ao abrir a página";
  if (status === "planejado") return "Ainda não roda";
  if (status === "externo") return "Produto à parte: abre em outra aba";
  const rodou = ultima ? `Rodou ${quandoRelativo(ultima.inicio) ?? "agora há pouco"}` : "Ainda não rodou";
  if (!agente.ativo) return `${rodou} · pausado, o horário automático está parado`;
  const cadencia = cadenciaLegivel(agente.cron);
  return cadencia ? `${rodou} · roda ${cadencia}` : rodou;
}

/**
 * Cabeçalho da ficha do agente: quem é, o que faz, como está, quanto custou e quanto pode
 * fazer sozinho. Agente que já roda ganha "Rodar agora" e "Pausar".
 */
export function AgenteCabecalho({
  agente,
  status,
  ultima,
  custo30d,
  carregando,
}: {
  agente: OpsAgente | undefined;
  status: StatusAgente;
  ultima: OpsExecucao | null;
  /** Custo de IA em 30 dias, já formatado; null quando não há execução. */
  custo30d: string | null;
  carregando: boolean;
}) {
  const rodar = useRodarAgente();
  const definirAtivo = useDefinirAgenteAtivo();

  if (carregando || !agente) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const autonomia = Object.entries((agente.autonomia ?? {}) as Record<string, string>).filter(([tipo]) => TIPO[tipo]);
  const plano = PLANO_DOS_AGENTES[agente.id as AgenteId];
  const executavel = ehExecutavel(agente.id);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">{agente.nome}</h2>
          <StatusBadge domain="ops_agente" status={status} />
        </div>
        <p className="text-sm text-ink-soft">{agente.missao}</p>
        <p className="text-xs text-ink-muted">
          {linhaExecucao(agente, status, ultima)}
          {!executavel && plano && status !== "externo" ? ` · ${plano.quando}` : ""}
          {custo30d ? ` · IA em 30 dias: ${custo30d}` : ""}
        </p>
        {ultima?.status === "falhou" && ultima.erro && (
          <p className="text-xs text-danger-strong" role="alert">
            A última execução falhou: {ultima.erro}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
        {executavel && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" loading={rodar.isPending} onClick={() => rodar.mutate(agente.id)}>
              <RefreshCw size={14} />
              Rodar agora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={definirAtivo.isPending}
              onClick={() => definirAtivo.mutate({ agenteId: agente.id, ativo: !agente.ativo })}
            >
              {agente.ativo ? <Pause size={14} /> : <Play size={14} />}
              {agente.ativo ? "Pausar" : "Retomar"}
            </Button>
          </div>
        )}
        {autonomia.length > 0 && status !== "externo" && (
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
            {autonomia.map(([tipo, nivel]) => (
              <div key={tipo} className="contents">
                <dt className="text-ink-muted">{TIPO[tipo]}</dt>
                <dd className="text-ink-soft">{NIVEL[nivel] ?? nivel}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
