import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type Notificacao = Tables<"notificacoes">;
export type AbaNotificacao = "inbox" | "archive";

const LISTA_KEY = ["notificacoes"];
const NAO_LIDAS_KEY = ["notificacoes-nao-lidas"];

const SELECT =
  "id, empresa_id, destinatario_id, tipo, categoria, severidade, titulo, mensagem, referencia_tipo, referencia_id, link, lido_em, arquivada_em, created_at, expires_at";

/** Lista as notificações da aba (RLS restringe ao destinatário). Inbox = não
 * arquivadas; Arquivadas = arquivadas. */
export function useNotificacoes(aba: AbaNotificacao = "inbox", limit = 50) {
  return useQuery({
    queryKey: [...LISTA_KEY, aba, limit],
    queryFn: async (): Promise<Notificacao[]> => {
      let q = supabase.from("notificacoes").select(SELECT);
      q = aba === "inbox" ? q.is("arquivada_em", null) : q.not("arquivada_em", "is", null);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
  });
}

/** Contagem de não lidas no inbox — alimenta o badge do sino e a aba Inbox. */
export function useNotificacoesNaoLidas() {
  return useQuery({
    queryKey: NAO_LIDAS_KEY,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .is("lido_em", null)
        .is("arquivada_em", null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 30,
  });
}

/**
 * Assina o Realtime de `notificacoes` e revalida quando algo muda. Montado uma
 * vez no sino; RLS é a barreira, o filtro por destinatário é só eficiência.
 */
export function useNotificacoesRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const canal = supabase
      .channel("notificacoes-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `destinatario_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: LISTA_KEY });
          queryClient.invalidateQueries({ queryKey: NAO_LIDAS_KEY });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [user?.id, queryClient]);
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: LISTA_KEY });
  queryClient.invalidateQueries({ queryKey: NAO_LIDAS_KEY });
}

/** Marca uma notificação como lida (só a própria; RLS garante). */
export function useMarcarLida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lido_em: new Date().toISOString() })
        .eq("id", id)
        .is("lido_em", null);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient),
  });
}

/** Marca todas as não lidas do inbox como lidas. */
export function useMarcarTodasLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lido_em: new Date().toISOString() })
        .is("lido_em", null)
        .is("arquivada_em", null);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient),
  });
}

/** Arquiva uma notificação (tira do inbox, mantém o histórico). */
export function useArquivar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ arquivada_em: new Date().toISOString() })
        .eq("id", id)
        .is("arquivada_em", null);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient),
  });
}

/** Arquiva todas as notificações do inbox. */
export function useArquivarTodas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ arquivada_em: new Date().toISOString() })
        .is("arquivada_em", null);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient),
  });
}
