import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AgentRun = Tables<"agent_runs">;
export type AgentAction = Tables<"agent_actions">;

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
const FEED_KEY = ["agent-runs", "feed"];

/**
 * Tipos de run que esta fila sabe renderizar e aprovar INLINE. Os drafts do chat
 * (criar_lead, criar_projeto, etc.) também nascem `pending_review`, mas sua
 * aprovação vive na conversa (cards de confirmação do useChat), não aqui.
 */
export const TIPOS_REVISAVEIS = ["orcamento_honorarios"];

/** Só os orçamentos pendentes de aprovação inline (alimenta o badge de contagem). */
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

/**
 * Feed completo da mesa de trabalho: todos os runs da empresa (qualquer tipo e
 * estado), recentes primeiro. A UI agrupa por estado (precisa de você / em
 * andamento / concluído / arquivado). RLS já restringe à empresa do usuário.
 */
export function useAgentRunsFeed(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: async (): Promise<AgentRun[]> => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
    enabled,
  });

  // Realtime (spec 007, Fase 2b): a mesa se atualiza sozinha quando um run muda de
  // estado. O RLS já filtra para a empresa do usuário, sem vazamento cross-tenant.
  useEffect(() => {
    if (!enabled) return;
    const canal = supabase
      .channel("agent-runs-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => {
        queryClient.invalidateQueries({ queryKey: FEED_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [enabled, queryClient]);

  return query;
}

/**
 * Detalhe de um run + seu log de passos (`agent_actions`) para o modal de raciocínio.
 * Enquanto o run está em andamento (queued/running), refaz a busca a cada 2s — é o
 * "tempo real" via polling da Fase 2a (o Realtime nativo entra na 2b). Ver spec 007.
 */
export function useAgentRunDetail(runId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["agent-run-detail", runId],
    enabled: !!runId,
    queryFn: async (): Promise<{ run: AgentRun; actions: AgentAction[] }> => {
      const [runRes, actionsRes] = await Promise.all([
        supabase.from("agent_runs").select("*").eq("id", runId!).single(),
        supabase
          .from("agent_actions")
          .select("*")
          .eq("run_id", runId!)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ]);
      if (runRes.error) throw runRes.error;
      if (actionsRes.error) throw actionsRes.error;
      return { run: runRes.data, actions: actionsRes.data ?? [] };
    },
    // Fallback de polling enquanto o run está ativo, caso o Realtime não conecte.
    refetchInterval: (query) => {
      const status = query.state.data?.run?.status;
      return status === "queued" || status === "running" ? 2000 : false;
    },
    staleTime: 1000 * 5,
  });

  // Realtime (spec 007, Fase 2b): novos passos (agent_actions) e transições de estado
  // do run aberto chegam ao modal sem refresh. Filtrado pelo run_id; RLS é a barreira.
  useEffect(() => {
    if (!runId) return;
    const canal = supabase
      .channel(`agent-run-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_actions", filter: `run_id=eq.${runId}` },
        () => queryClient.invalidateQueries({ queryKey: ["agent-run-detail", runId] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_runs", filter: `id=eq.${runId}` },
        () => queryClient.invalidateQueries({ queryKey: ["agent-run-detail", runId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [runId, queryClient]);

  return query;
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
