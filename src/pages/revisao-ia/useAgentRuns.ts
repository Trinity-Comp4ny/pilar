import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AgentRun = Tables<"agent_runs">;

/** Espelha o OrcamentoSchema (Zod) da edge function ai-proposta-copilot. */
export interface OrcamentoFase {
  disciplina: string;
  horas_estimadas: number;
  custo_hora: number;
  margem_alvo_pct: number;
  observacao?: string;
}

export interface OrcamentoResult {
  resumo: string;
  fases: OrcamentoFase[];
  premissas?: string[];
  riscos?: string[];
  perguntas_faltantes?: string[];
}

const QUERY_KEY = ["agent-runs", "pending_review"];

/**
 * Tipos de run que esta fila sabe renderizar e aprovar. Filtra explicitamente:
 * drafts do chat (criar_lead, criar_projeto, etc.) também nascem `pending_review`,
 * e sem este filtro vazariam pra cá como "formato não reconhecido".
 */
const TIPOS_REVISAVEIS = ["orcamento_honorarios"];

/** Fila de drafts aguardando revisão humana (cockpit). */
export function useAgentInbox(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<AgentRun[]> => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("status", "pending_review")
        .in("agent_type", TIPOS_REVISAVEIS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
    enabled: options?.enabled ?? true,
  });
}

/** Aprova um draft de orçamento: materializa as fases em projeto_orcamento_fases (RPC atômica). */
export function useAprovarOrcamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.rpc("aprovar_orcamento_agente", { p_run_id: runId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-runs"] });
      queryClient.invalidateQueries({ queryKey: ["projeto-orcamento"] });
    },
  });
}

/** Rejeita um draft (não vira domínio). O motivo da rejeição é sinal de eval futuro. */
export function useRejeitarRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from("agent_runs")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-runs"] });
    },
  });
}
