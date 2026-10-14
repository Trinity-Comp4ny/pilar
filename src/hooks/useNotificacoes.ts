import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { contarPorCategoria, type CategoriaNotificacao } from "@/lib/notificacoes";

export type Notificacao = Tables<"notificacoes">;
export type AbaNotificacao = "inbox" | "archive";

const LISTA_KEY = ["notificacoes"];
const NAO_LIDAS_KEY = ["notificacoes-nao-lidas"];

const SELECT =
  "id, empresa_id, destinatario_id, tipo, categoria, severidade, titulo, mensagem, referencia_tipo, referencia_id, link, lido_em, arquivada_em, email_enviado_em, created_at, expires_at";

/** Lista as notificações da aba (RLS restringe ao destinatário). Inbox = não
 * arquivadas; Arquivadas = arquivadas. `categoria` filtra no banco: o limite vale
 * por categoria, então um volume alto de uma (ex.: financeiro) não esconde as outras. */
export function useNotificacoes(
  aba: AbaNotificacao = "inbox",
  limit = 50,
  categoria: CategoriaNotificacao | null = null
) {
  return useQuery({
    queryKey: [...LISTA_KEY, aba, limit, categoria],
    queryFn: async (): Promise<Notificacao[]> => {
      let q = supabase.from("notificacoes").select(SELECT);
      q = aba === "inbox" ? q.is("arquivada_em", null) : q.not("arquivada_em", "is", null);
      if (categoria) q = q.eq("categoria", categoria);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
  });
}

/** Não lidas do inbox por categoria: alimenta o badge do sino (soma) e os chips do filtro. */
export function useNotificacoesNaoLidas() {
  return useQuery({
    queryKey: NAO_LIDAS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("categoria")
        .is("lido_em", null)
        .is("arquivada_em", null);
      if (error) throw error;
      const porCategoria = contarPorCategoria(data ?? []);
      const total = Object.values(porCategoria).reduce((soma, n) => soma + n, 0);
      return { total, porCategoria };
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

/** Marca como lidas todas as não lidas do inbox (só as da categoria, se informada). */
export function useMarcarTodasLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categoria: CategoriaNotificacao | null = null) => {
      let q = supabase
        .from("notificacoes")
        .update({ lido_em: new Date().toISOString() })
        .is("lido_em", null)
        .is("arquivada_em", null);
      if (categoria) q = q.eq("categoria", categoria);
      const { error } = await q;
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

/** Arquiva todas as notificações do inbox (só as da categoria, se informada). */
export function useArquivarTodas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categoria: CategoriaNotificacao | null = null) => {
      let q = supabase.from("notificacoes").update({ arquivada_em: new Date().toISOString() }).is("arquivada_em", null);
      if (categoria) q = q.eq("categoria", categoria);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient),
  });
}
