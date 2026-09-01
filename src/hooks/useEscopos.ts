import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EscopoRow = Tables<"escopos"> & { escopo_itens: Tables<"escopo_itens">[] };
export type OrcamentoFaseRow = Pick<
  Tables<"projeto_orcamento_fases">,
  "disciplina" | "horas_estimadas" | "custo_hora" | "custo_estimado"
>;

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

/**
 * Orçamento vivo do projeto por disciplina (spec 083; fonte do card "Orçamento vivo" e
 * do guardião de margem, spec 081). Uma linha por disciplina que já tem orçamento
 * definido em projeto_orcamento_fases — disciplinas sem orçamento não aparecem aqui;
 * a tela junta com a lista de disciplinas do projeto pra mostrar todas.
 */
export function useOrcamentoFases(projetoId: string | undefined) {
  return useQuery({
    queryKey: projetoId ? orcamentoVivoKey(projetoId) : ["projeto_orcamento_fases", "sem-projeto"],
    enabled: !!projetoId,
    queryFn: async (): Promise<OrcamentoFaseRow[]> => {
      const { data, error } = await supabase
        .from("projeto_orcamento_fases")
        .select("disciplina, horas_estimadas, custo_hora, custo_estimado")
        .eq("projeto_id", projetoId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Define/atualiza o orçamento de uma disciplina (spec 083, destrava o guardião de
 * margem — ver spec 081). Upsert por projeto_id+disciplina, mesma unicidade que
 * handle_escopo_aprovado já respeita ao somar itens de aditivo aprovado nesta tabela.
 */
export function useSalvarOrcamentoFase(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { disciplina: string; horasEstimadas: number; custoHora: number }): Promise<void> => {
      const { data: empresaId, error: empresaErr } = await supabase.rpc("get_user_empresa_id");
      if (empresaErr) throw empresaErr;
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { error } = await supabase.from("projeto_orcamento_fases").upsert(
        {
          empresa_id: empresaId,
          projeto_id: projetoId,
          disciplina: params.disciplina,
          horas_estimadas: params.horasEstimadas,
          custo_hora: params.custoHora,
        },
        { onConflict: "projeto_id,disciplina" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: orcamentoVivoKey(projetoId) }),
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
