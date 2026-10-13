import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentHeartbeat {
  agent_type: string;
  last_run_at: string;
  last_status: string;
  detail: { encontrados?: number; criados?: number; falhas?: number; pulados_sem_creditos?: number } | null;
}

/**
 * Última execução registrada de um cron agêntico (guardiao_margem_cron etc), pra UI
 * distinguir "não achou nada pra fazer" de "está quebrado e não roda há dias". Achado
 * que motivou isto: o guardião de margem ficou 8 dias fora do ar (401 de auth) sem
 * nenhum sinal visível pro usuário, só descoberto quando o cliente reclamou.
 */
export function useAgentHeartbeat(agentType: string) {
  return useQuery({
    queryKey: ["agent_cron_heartbeats", agentType],
    queryFn: async (): Promise<AgentHeartbeat | null> => {
      const { data, error } = await supabase
        .from("agent_cron_heartbeats")
        .select("agent_type, last_run_at, last_status, detail")
        .eq("agent_type", agentType)
        .maybeSingle();
      if (error) throw error;
      return data as AgentHeartbeat | null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
