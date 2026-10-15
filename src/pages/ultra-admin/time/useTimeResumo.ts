import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAcoesPendentes, useAgentes, useReceita, useSaudeEmpresas, useUltimasExecucoes } from "./hooks";
import { decisoesDoDia, statusDoAgente, type StatusAgente } from "./lib";
import type { OpsAgente, OpsExecucao } from "./api";

export type AgenteResumo = {
  agente: OpsAgente;
  status: StatusAgente;
  ultima: OpsExecucao | null;
  pendentes: number;
};

/** Janela padrão da Central e da ficha Receita. */
const DIAS_PADRAO = 30;

/**
 * Tudo que a Central precisa num lugar: agentes com status, decisões do dia (por regra
 * na fase 0) e os números de Receita e Clientes que alimentam os cartões.
 */
export function useTimeResumo(diasReceita: number = DIAS_PADRAO) {
  const { profile } = useAuth();
  const agentesQ = useAgentes();
  const execucoesQ = useUltimasExecucoes();
  const pendentesQ = useAcoesPendentes();
  const receitaQ = useReceita(diasReceita);
  const saudeQ = useSaudeEmpresas();

  const remetente = profile?.first_name?.trim() || "a equipe";

  const agentes = useMemo<AgenteResumo[]>(() => {
    const pendentesPorAgente = new Map<string, number>();
    for (const a of pendentesQ.data ?? []) {
      pendentesPorAgente.set(a.agente_id, (pendentesPorAgente.get(a.agente_id) ?? 0) + 1);
    }
    return (agentesQ.data ?? []).map((agente) => {
      const ultima = execucoesQ.data?.get(agente.id) ?? null;
      const pendentes = pendentesPorAgente.get(agente.id) ?? 0;
      return { agente, ultima, pendentes, status: statusDoAgente(agente, ultima, pendentes) };
    });
  }, [agentesQ.data, execucoesQ.data, pendentesQ.data]);

  const decisoes = useMemo(
    () => decisoesDoDia(receitaQ.data, saudeQ.data, remetente),
    [receitaQ.data, saudeQ.data, remetente]
  );

  return { agentes, decisoes, agentesQ, receitaQ, saudeQ, remetente };
}
