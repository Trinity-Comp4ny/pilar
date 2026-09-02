import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ExtratoTokenEvento {
  id: string;
  createdAt: string;
  agentKey: string;
  tokensTotal: number;
  userNome: string | null;
}

const AGENT_LABEL: Record<string, string> = {
  ai_chat: "Chat de Agentes",
  "cotacao-import": "Leitura de cotação",
  "import-financeiro": "Importação financeira",
};

export function agentKeyLabel(agentKey: string): string {
  return AGENT_LABEL[agentKey] ?? agentKey;
}

// Extrato de consumo da própria empresa (spec 076, princípio 2 do MOTOR_DE_TOKENS:
// transparência total). Seleciona só as colunas que o cliente pode ver — NUNCA
// custo_estimado (COGS), que fica restrito ao painel interno do ultra-admin.
export function useExtratoTokens() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;

  const query = useQuery({
    queryKey: ["extrato-tokens", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<ExtratoTokenEvento[]> => {
      const { data, error } = await supabase
        .from("v_extrato_tokens")
        .select("id, created_at, agent_key, tokens_total, user_nome")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        createdAt: r.created_at as string,
        agentKey: r.agent_key as string,
        tokensTotal: r.tokens_total as number,
        userNome: r.user_nome as string | null,
      }));
    },
  });

  return { eventos: query.data ?? [], isLoading: query.isLoading, error: query.error as Error | null };
}
