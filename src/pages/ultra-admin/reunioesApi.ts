// SPEC 169: leitura e escrita do cérebro de reuniões no Ultra. Leitura direta (RLS só do
// ultra admin); análise pela Edge Function `reuniao-analisar`; curadoria só de
// `tipo_corrigido` e `removido`.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaInsight } from "./cerebroLib";

export interface Reuniao {
  id: string;
  titulo: string;
  ocorreu_em: string;
  origem_nome: string | null;
  origem_contato: string | null;
  tipo: string;
  tipo_confianca: number | null;
  tipo_corrigido: string | null;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
  redacoes: Record<string, number> | null;
  status: string;
}

export interface NovaReuniao {
  titulo: string;
  ocorreu_em: string;
  origem_nome?: string;
  origem_contato: string;
  transcript: string;
}

const COLUNAS =
  "id, titulo, ocorreu_em, origem_nome, origem_contato, tipo, tipo_confianca, tipo_corrigido, proximo_passo, proximo_passo_em, redacoes, status";

export function useReunioes() {
  return useQuery({
    queryKey: ["ultra-reunioes"],
    queryFn: async (): Promise<Reuniao[]> => {
      const { data, error } = await supabase
        .from("reuniao")
        .select(COLUNAS)
        .order("ocorreu_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Reuniao[];
    },
  });
}

export function useReuniao(id: string | undefined) {
  return useQuery({
    queryKey: ["ultra-reuniao", id],
    enabled: !!id,
    queryFn: async () => {
      const [r, i, s, c] = await Promise.all([
        supabase.from("reuniao").select(COLUNAS).eq("id", id!).single(),
        supabase.from("reuniao_insight").select("*").eq("reuniao_id", id!).order("created_at"),
        supabase.from("reuniao_segmento").select("*").eq("reuniao_id", id!).order("inicio"),
        supabase.from("compromisso").select("*").eq("reuniao_id", id!).order("created_at"),
      ]);
      const erro = r.error ?? i.error ?? s.error ?? c.error;
      if (erro) throw erro;
      return {
        reuniao: r.data as unknown as Reuniao,
        insights: i.data ?? [],
        segmentos: s.data ?? [],
        compromissos: c.data ?? [],
      };
    },
  });
}

export function useInsightsDoCerebro() {
  return useQuery({
    queryKey: ["ultra-cerebro-insights"],
    queryFn: async (): Promise<LinhaInsight[]> => {
      const { data, error } = await supabase
        .from("reuniao_insight")
        .select(
          "id, reuniao_id, categoria, texto, citacao, modulo_pilar, removido, reuniao(origem_nome, origem_contato)"
        )
        .eq("removido", false)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as LinhaInsight[];
    },
  });
}

export function useAnalisarReuniao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (corpo: NovaReuniao) => {
      const { data, error } = await supabase.functions.invoke("reuniao-analisar", { body: corpo });
      if (error) {
        let mensagem = "A análise falhou. Tente de novo.";
        try {
          const j = await (error as { context?: Response }).context?.json();
          if (j?.error) mensagem = j.error;
        } catch {
          // mantém a mensagem padrão
        }
        throw new Error(mensagem);
      }
      return data as { reuniao_id: string; insights: number; descartados_sem_citacao: number; compromissos: number };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ultra-reunioes"] });
      void qc.invalidateQueries({ queryKey: ["ultra-cerebro-insights"] });
    },
  });
}

export function useCorrigirTipo(reuniaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipo: string) => {
      const { error } = await supabase.from("reuniao").update({ tipo_corrigido: tipo }).eq("id", reuniaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ultra-reuniao", reuniaoId] });
      void qc.invalidateQueries({ queryKey: ["ultra-reunioes"] });
    },
  });
}

export function useRemoverInsight(reuniaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase.from("reuniao_insight").update({ removido: true }).eq("id", insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ultra-reuniao", reuniaoId] });
      void qc.invalidateQueries({ queryKey: ["ultra-cerebro-insights"] });
    },
  });
}
