import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EscopoRow = Tables<"escopos"> & { escopo_itens: Tables<"escopo_itens">[] };

const escoposKey = (projetoId: string) => ["escopos", projetoId] as const;
const orcamentoVivoKey = (projetoId: string) => ["projeto_orcamento_fases", projetoId] as const;

/** Escopo original + aditivos (qualquer status) de um projeto, com itens. */
export function useEscopos(projetoId: string | undefined) {
  return useQuery({
    queryKey: projetoId ? escoposKey(projetoId) : ["escopos", "sem-projeto"],
    enabled: !!projetoId,
    queryFn: async (): Promise<EscopoRow[]> => {
      const { data, error } = await supabase
        .from("escopos")
        .select("*, escopo_itens(*)")
        .eq("projeto_id", projetoId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EscopoRow[];
    },
    staleTime: 1000 * 60,
  });
}

/** Orçamento vivo do projeto: soma de projeto_orcamento_fases (a mesma fonte do guardião de margem). */
export function useOrcamentoVivo(projetoId: string | undefined) {
  return useQuery({
    queryKey: projetoId ? orcamentoVivoKey(projetoId) : ["projeto_orcamento_fases", "sem-projeto"],
    enabled: !!projetoId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("projeto_orcamento_fases")
        .select("custo_estimado")
        .eq("projeto_id", projetoId!)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + (r.custo_estimado ?? 0), 0);
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Aprova um escopo (rascunho/pendente → aprovado). RLS já libera pra quem tem
 * projetos:editor; o trigger handle_escopo_aprovado (banco) soma os itens em
 * projeto_orcamento_fases e incrementa projetos.valor_contrato — nada disso
 * acontece aqui, é efeito colateral do UPDATE.
 */
export function useAprovarEscopo(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (escopoId: string): Promise<void> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("escopos")
        .update({ status: "aprovado", aprovado_por: user?.id ?? null, aprovado_em: new Date().toISOString() })
        .eq("id", escopoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: escoposKey(projetoId) });
      qc.invalidateQueries({ queryKey: orcamentoVivoKey(projetoId) });
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
    },
  });
}

/** Rejeita um escopo (rascunho/pendente → rejeitado). Não altera contrato nem orçamento. */
export function useRejeitarEscopo(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (escopoId: string): Promise<void> => {
      const { error } = await supabase.from("escopos").update({ status: "rejeitado" }).eq("id", escopoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: escoposKey(projetoId) }),
  });
}
