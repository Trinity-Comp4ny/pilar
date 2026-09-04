import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { reportInvokeError } from "@/lib/monitoring";
import { getSafeErrorMessage } from "@/lib/safeError";

export interface MembroUsoToken {
  userId: string;
  nome: string;
  role: string | null;
  tokensCiclo: number;
  limiteMensal: number | null;
  solicitacaoPendente: boolean;
}

export interface SolicitacaoTokenPendente {
  id: string;
  userId: string;
  nome: string;
  mensagem: string | null;
  limiteSugerido: number | null;
  criadaEm: string;
}

const QUERY_KEY = "uso-equipe-tokens";

// Fonte única (spec 094): v_uso_tokens_usuario_ciclo já traz consumo do ciclo +
// teto (quando existe) por usuário; RLS restringe quem administra equipe a ver
// o teto de todos (um usuário comum só veria o próprio, então este hook só deve
// ser usado atrás de canDo(ctx, 'pessoas')).
export function useUsoEquipe() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  const queryClient = useQueryClient();

  const membrosQuery = useQuery({
    queryKey: [QUERY_KEY, "membros", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<MembroUsoToken[]> => {
      const { data, error } = await supabase
        .from("v_uso_tokens_usuario_ciclo")
        .select("user_id, user_nome, role, tokens_ciclo, limite_mensal, solicitacao_pendente")
        .eq("empresa_id", empresaId!)
        .order("tokens_ciclo", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((r): r is typeof r & { user_id: string } => !!r.user_id)
        .map((r) => ({
          userId: r.user_id,
          nome: r.user_nome ?? "(sem nome)",
          role: r.role,
          tokensCiclo: r.tokens_ciclo ?? 0,
          limiteMensal: r.limite_mensal,
          solicitacaoPendente: r.solicitacao_pendente ?? false,
        }));
    },
  });

  const solicitacoesQuery = useQuery({
    queryKey: [QUERY_KEY, "solicitacoes", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 15,
    queryFn: async (): Promise<SolicitacaoTokenPendente[]> => {
      const { data, error } = await supabase
        .from("ai_token_solicitacao")
        .select("id, user_id, mensagem, limite_sugerido, created_at, profiles:user_id(first_name, last_name)")
        .eq("empresa_id", empresaId!)
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const perfil = r.profiles as { first_name: string | null; last_name: string | null } | null;
        const nome = [perfil?.first_name, perfil?.last_name].filter(Boolean).join(" ").trim();
        return {
          id: r.id,
          userId: r.user_id,
          nome: nome || "(sem nome)",
          mensagem: r.mensagem,
          limiteSugerido: r.limite_sugerido,
          criadaEm: r.created_at,
        };
      });
    },
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
  };

  const definirLimite = useMutation({
    mutationFn: async ({ userId, limiteMensal }: { userId: string; limiteMensal: number | null }) => {
      if (limiteMensal === null) {
        const { error } = await supabase
          .from("ai_token_limite_usuario")
          .delete()
          .eq("empresa_id", empresaId!)
          .eq("user_id", userId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("ai_token_limite_usuario")
        .upsert(
          { empresa_id: empresaId!, user_id: userId, limite_mensal: limiteMensal, criado_por: profile?.id ?? null },
          { onConflict: "empresa_id,user_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      invalidar();
      toast.success(variables.limiteMensal === null ? "Limite removido" : "Limite de tokens atualizado");
    },
    onError: (err) => {
      reportInvokeError(err, "ai_token_limite_usuario:upsert");
      toast.error("Não foi possível salvar o limite", { description: getSafeErrorMessage(err) });
    },
  });

  const resolverSolicitacao = useMutation({
    mutationFn: async ({
      solicitacaoId,
      aprovar,
      novoLimite,
    }: {
      solicitacaoId: string;
      aprovar: boolean;
      novoLimite?: number | null;
    }) => {
      const { error } = await supabase.rpc("resolver_solicitacao_tokens", {
        p_solicitacao_id: solicitacaoId,
        p_aprovar: aprovar,
        p_novo_limite: novoLimite ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      invalidar();
      toast.success(variables.aprovar ? "Pedido aprovado" : "Pedido recusado");
    },
    onError: (err) => {
      reportInvokeError(err, "resolver_solicitacao_tokens");
      toast.error("Não foi possível responder o pedido", { description: getSafeErrorMessage(err) });
    },
  });

  return {
    membros: membrosQuery.data ?? [],
    isLoadingMembros: membrosQuery.isLoading,
    errorMembros: membrosQuery.error as Error | null,
    solicitacoes: solicitacoesQuery.data ?? [],
    isLoadingSolicitacoes: solicitacoesQuery.isLoading,
    definirLimite,
    resolverSolicitacao,
  };
}
