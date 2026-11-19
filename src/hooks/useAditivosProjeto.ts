import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface ParcelaPrevia {
  id?: string;
  descricao: string;
  vencimento: string;
  anterior: number;
  novo: number;
}

export interface PreviaAditivo {
  grupos: { id: string; nome: string; quantidade: number }[];
  linhas: ParcelaPrevia[];
  cliente: boolean;
  contrato: number;
  aditivo: number;
  saldo: number;
}

export interface OpcoesCobranca {
  p_aditivo: string;
  p_grupo?: string;
  p_vencimento?: string;
  p_parcelas?: number;
}

export interface OrigemAditivo {
  disciplinaId?: string;
  entregaId?: string;
  registroId?: string;
  descricao?: string;
  motivo?: string;
}

export function useCriarAditivoProjeto(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { descricao: string; motivo: string; valor: number; origem?: OrigemAditivo }) => {
      const { data, error } = await supabase.rpc("rpc_criar_aditivo_projeto", {
        p_projeto_id: projetoId,
        p_descricao: args.descricao,
        p_motivo: args.motivo,
        p_valor: args.valor,
        p_disciplina_id: args.origem?.disciplinaId,
        p_entrega_id: args.origem?.entregaId,
        p_registro_id: args.origem?.registroId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["escopos"] });
      void qc.invalidateQueries({ queryKey: ["projeto-timeline", projetoId] });
      void qc.invalidateQueries({ queryKey: ["aditivos-origens", projetoId] });
    },
  });
}

export function usePreviaAditivo(opcoes: OpcoesCobranca, enabled = true) {
  return useQuery({
    queryKey: ["previa-aditivo", opcoes],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_prever_cobranca_aditivo", opcoes);
      if (error) throw error;
      return data as unknown as PreviaAditivo;
    },
  });
}

export function useConfirmarAditivo(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      opcoes,
      previa,
      aceite,
    }: {
      opcoes: OpcoesCobranca;
      previa: PreviaAditivo;
      aceite: string;
    }) => {
      const { error } = await supabase.rpc("rpc_confirmar_cobranca_aditivo", {
        ...opcoes,
        p_previa: previa as unknown as Json,
        p_aceite: aceite.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const queryKey of [
        ["escopos"],
        ["projeto_orcamento_fases", projetoId],
        ["projeto-detail", projetoId],
        ["projetos"],
        ["pagamentos-projeto", projetoId],
        ["receitas"],
        ["lancamentos"],
        ["grupos-parcela-resumo"],
        ["lancamentos-parcelas-dos-grupos"],
        ["projeto-timeline", projetoId],
        ["resumo-aditivos", projetoId],
      ]) {
        void qc.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useResumoAditivos(projetoId: string) {
  return useQuery({
    queryKey: ["resumo-aditivos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_resumo_aditivos_projeto", { p_projeto: projetoId });
      if (error) throw error;
      return data as { original: number | null; total: number | null; aprovados: number };
    },
  });
}

export function useOrigensAditivos(projetoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["aditivos-origens", projetoId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_registros")
        .select("origem_id, detalhe, dados")
        .eq("projeto_id", projetoId)
        .eq("tipo", "aditivo_criado");
      if (error) throw error;
      return data.map((row) => ({
        id: row.origem_id,
        titulo: row.detalhe,
        origem: row.dados as { entrega_id?: string; atividade_id?: string },
      }));
    },
  });
}
