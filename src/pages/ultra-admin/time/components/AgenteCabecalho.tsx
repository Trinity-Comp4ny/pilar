import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { quandoRelativo } from "../../lib";
import type { OpsAgente, OpsExecucao } from "../api";
import { PLANO_DOS_AGENTES, type AgenteId, type StatusAgente } from "../lib";

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

function linhaExecucao(status: StatusAgente, ultima: OpsExecucao | null): string {
  if (status === "so_numeros") return "Números do banco, atualizados ao abrir a página";
  if (status === "planejado") return "Ainda não roda";
  if (!ultima) return "Ainda não rodou";
  return `Rodou ${quandoRelativo(ultima.inicio) ?? "agora há pouco"}`;
}

/** Cabeçalho da ficha do agente: quem é, o que faz, como está e quanto pode fazer sozinho. */
export function AgenteCabecalho({
  agente,
  status,
  ultima,
  carregando,
}: {
  agente: OpsAgente | undefined;
  status: StatusAgente;
  ultima: OpsExecucao | null;
  carregando: boolean;
}) {
  if (carregando || !agente) return <Skeleton className="h-20 w-full rounded-2xl" />;

  const autonomia = Object.entries((agente.autonomia ?? {}) as Record<string, string>).filter(([tipo]) => TIPO[tipo]);
  const plano = PLANO_DOS_AGENTES[agente.id as AgenteId];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">{agente.nome}</h2>
          <StatusBadge domain="ops_agente" status={status} />
        </div>
        <p className="text-sm text-ink-soft">{agente.missao}</p>
        <p className="text-xs text-ink-muted">
          {linhaExecucao(status, ultima)}
          {plano && status !== "ok" && status !== "atencao" ? ` · ${plano.quando}` : ""}
        </p>
      </div>
      {autonomia.length > 0 && (
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
          {autonomia.map(([tipo, nivel]) => (
            <div key={tipo} className="contents">
              <dt className="text-ink-muted">{TIPO[tipo]}</dt>
              <dd className="text-ink-soft">{NIVEL[nivel] ?? nivel}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
