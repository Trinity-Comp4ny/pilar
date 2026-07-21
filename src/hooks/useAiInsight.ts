import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Módulo IA Hub dormente — tabelas ai_insights/ai_usage removidas do banco

export interface AiInsight {
  id: string;
  empresa_id: string;
  tipo: string;
  referencia_id: string | null;
  referencia_tipo: string | null;
  conteudo: Json;
  resumo: string | null;
  status: string;
  mes_referencia: number | null;
  ano_referencia: number | null;
  modelo_ia: string | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  created_at: string;
}

export interface AiUsage {
  total_requests: number;
  limite_requests: number;
  total_tokens_entrada: number;
  total_tokens_saida: number;
}

// Núcleo defensável (decisão de time 2026-07-20): só as tools na espinha
// "lucro por projeto". As demais ai-* seguem no backend, dormentes, mas fora
// do hub. Ver docs/strategy/DECISAO_IA_FEATURES_AGENTES_2026-07-20.md
export const AI_TIPOS = {
  proposta_copilot: {
    label: "Co-piloto de Proposta",
    descricao: "Sugestão de escopo, horas e preço para novas propostas",
    edgeFunction: "ai-proposta-copilot",
    icon: "FileText",
  },
  aditivo_copilot: {
    label: "Co-piloto de Aditivo",
    descricao: "Análise de impacto e sugestão de aditivo contratual",
    edgeFunction: "ai-aditivo-copilot",
    icon: "FilePlus2",
  },
  diagnostico_precificacao: {
    label: "Diagnóstico de Precificação",
    descricao: "Análise de margens, valor/hora e estratégia de preços",
    edgeFunction: "ai-diagnostico-precificacao",
    icon: "BadgeDollarSign",
  },
} as const;

export type AiTipo = keyof typeof AI_TIPOS;

/**
 * Busca insights recentes de um tipo
 */
export const useAiInsights = (_tipo?: AiTipo, _limit = 10) => {
  return useQuery({
    queryKey: ["ai-insights", _tipo, _limit],
    queryFn: async (): Promise<AiInsight[]> => [],
    staleTime: 1000 * 60 * 60,
  });
};

/**
 * Busca uso de IA do mês atual
 */
export const useAiUsage = () => {
  return useQuery({
    queryKey: ["ai-usage"],
    queryFn: async (): Promise<AiUsage> => ({
      total_requests: 0,
      limite_requests: 100,
      total_tokens_entrada: 0,
      total_tokens_saida: 0,
    }),
    staleTime: 1000 * 60 * 60,
  });
};

/**
 * Gera um novo insight de IA
 */
export const useGenerateInsight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tipo, params }: { tipo: AiTipo; params?: Record<string, unknown> }) => {
      const config = AI_TIPOS[tipo];

      const { data, error } = await supabase.functions.invoke(config.edgeFunction, {
        body: params || {},
      });

      if (error) throw error;
      // Non-2xx com corpo de erro, ou 2xx sem payload: tratar como falha em vez
      // de fingir sucesso (ACH-AI-01).
      if (!data || (typeof data === "object" && "error" in data)) {
        const msg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "";
        throw new Error(msg || "A IA não retornou um resultado válido.");
      }
      return data as AiInsight;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-insights"] });
      queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
    },
  });
};
