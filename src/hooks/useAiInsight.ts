import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiInsight {
  id: string;
  empresa_id: string;
  tipo: string;
  referencia_id: string | null;
  referencia_tipo: string | null;
  conteudo: any;
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

export const AI_TIPOS = {
  fechamento_mensal: {
    label: "Fechamento Mensal",
    descricao: "Análise financeira do mês com insights e recomendações",
    edgeFunction: "ai-fechamento-mensal",
    icon: "BarChart3",
  },
  proposta_copilot: {
    label: "Co-piloto de Proposta",
    descricao: "Sugestão de escopo, horas e preço para novas propostas",
    edgeFunction: "ai-proposta-copilot",
    icon: "FileText",
  },
  previsao_atraso: {
    label: "Previsão de Atraso",
    descricao: "Análise de risco de atraso e estouro por projeto",
    edgeFunction: "ai-previsao-atraso",
    icon: "AlertTriangle",
  },
  radar_cliente: {
    label: "Radar de Clientes",
    descricao: "Classificação de clientes por nível de risco",
    edgeFunction: "ai-radar-cliente",
    icon: "Users",
  },
  relatorio_executivo: {
    label: "Relatório Executivo",
    descricao: "Resumo executivo semanal ou mensal para reunião de diretoria",
    edgeFunction: "ai-relatorio-executivo",
    icon: "FileCheck",
  },
} as const;

export type AiTipo = keyof typeof AI_TIPOS;

/**
 * Busca insights recentes de um tipo
 */
export const useAiInsights = (tipo?: AiTipo, limit = 10) => {
  return useQuery({
    queryKey: ["ai-insights", tipo, limit],
    queryFn: async () => {
      let query = supabase
        .from("ai_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (tipo) {
        query = query.eq("tipo", tipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AiInsight[];
    },
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Busca uso de IA do mês atual
 */
export const useAiUsage = () => {
  return useQuery({
    queryKey: ["ai-usage"],
    queryFn: async () => {
      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();

      const { data, error } = await supabase
        .from("ai_usage")
        .select("total_requests, limite_requests, total_tokens_entrada, total_tokens_saida")
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (error) throw error;

      return (data || {
        total_requests: 0,
        limite_requests: 100,
        total_tokens_entrada: 0,
        total_tokens_saida: 0,
      }) as AiUsage;
    },
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Gera um novo insight de IA
 */
export const useGenerateInsight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tipo, params }: { tipo: AiTipo; params?: any }) => {
      const config = AI_TIPOS[tipo];

      const { data, error } = await supabase.functions.invoke(config.edgeFunction, {
        body: params || {},
      });

      if (error) throw error;
      return data as AiInsight;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-insights"] });
      queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
    },
  });
};
