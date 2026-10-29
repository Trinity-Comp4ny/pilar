import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Linha do convite como o escritório lê: o hash do token não sai pelo SELECT (privilégio por coluna). */
export interface ConviteCotacao {
  id: string;
  cotacao_id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  expira_em: string;
  aberto_em: string | null;
  respondido_em: string | null;
  revogado_em: string | null;
  proposta_id: string | null;
  created_at: string;
}

const COLUNAS =
  "id, cotacao_id, fornecedor_id, fornecedor_nome, expira_em, aberto_em, respondido_em, revogado_em, proposta_id, created_at";

const convitesKey = (cotacaoId: string) => ["obra_cotacao_convite", cotacaoId] as const;

export function useConvitesCotacao(cotacaoId: string) {
  return useQuery({
    queryKey: convitesKey(cotacaoId),
    // Quem espera a resposta vê o estado mudar sem recarregar.
    refetchInterval: 60_000,
    queryFn: async (): Promise<ConviteCotacao[]> => {
      const { data, error } = await supabase
        .from("obra_cotacao_convite")
        .select(COLUNAS)
        .eq("cotacao_id", cotacaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface NovoConvite {
  /** Fornecedor do cadastro; sem ele, `fornecedorNome` cadastra um novo. */
  fornecedorId: string | null;
  fornecedorNome: string | null;
  validadeDias: number;
}

/** Devolve o token UMA vez: o banco guarda só o hash. */
export function useCriarConvite(cotacaoId: string, obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: NovoConvite): Promise<{ token: string; fornecedor_id: string }> => {
      const { data, error } = await supabase.rpc("rpc_criar_convite_cotacao", {
        p_cotacao_id: cotacaoId,
        p_fornecedor_id: n.fornecedorId ?? undefined,
        p_fornecedor_nome: n.fornecedorNome ?? undefined,
        p_validade_dias: n.validadeDias,
      });
      if (error) throw error;
      return data as unknown as { token: string; fornecedor_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: convitesKey(cotacaoId) });
      qc.invalidateQueries({ queryKey: ["fornecedores-lite"] });
      qc.invalidateQueries({ queryKey: ["obra_cotacao", obraId] });
    },
  });
}

export function useRevogarConvite(cotacaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conviteId: string) => {
      const { error } = await supabase.rpc("rpc_revogar_convite_cotacao", { p_convite_id: conviteId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: convitesKey(cotacaoId) }),
  });
}
