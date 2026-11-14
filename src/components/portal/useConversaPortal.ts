import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPortalToken } from "@/hooks/useClienteAuth";

/** Quem está olhando a conversa: o cliente (token do portal) ou a equipe do escritório (login). */
export type LadoConversa = "cliente" | "equipe";

/** A conversa é de um projeto OU de uma obra; com `entregaId` é o fio daquela solicitação. */
export interface EscopoConversa {
  projetoId?: string;
  obraId?: string;
  entregaId?: string;
}

export interface MensagemPortal {
  id: string;
  autor_tipo: "escritorio" | "cliente";
  autor_nome: string;
  texto: string;
  interna: boolean;
  created_at: string;
  /** Escrita por quem está olhando (equipe: o próprio usuário; cliente: qualquer mensagem do cliente). */
  minha: boolean;
  /** A outra parte ainda não viu. */
  nao_lida: boolean;
}

/** Atualiza sozinha a cada 15 s: o cliente não tem login Supabase, então não há realtime. */
const INTERVALO_MS = 15_000;

const chave = (lado: LadoConversa, e: EscopoConversa) =>
  ["portal-mensagens", lado, e.projetoId ?? null, e.obraId ?? null, e.entregaId ?? null] as const;

const argsRpc = (e: EscopoConversa) => ({
  p_projeto_id: e.projetoId ?? undefined,
  p_obra_id: e.obraId ?? undefined,
  p_entrega_id: e.entregaId ?? undefined,
});

export function useConversaPortal(lado: LadoConversa, escopo: EscopoConversa, ativo = true) {
  const qc = useQueryClient();
  const { profile, user } = useAuth();
  const key = chave(lado, escopo);

  const mensagens = useQuery({
    queryKey: key,
    enabled: ativo,
    refetchInterval: INTERVALO_MS,
    queryFn: async (): Promise<MensagemPortal[]> => {
      if (lado === "cliente") {
        const token = getPortalToken();
        if (!token) throw new Error("Não autenticado");
        const { data, error } = await supabase.rpc("portal_listar_mensagens", { p_token: token, ...argsRpc(escopo) });
        if (error) throw error;
        return (data ?? []).map((m) => ({
          id: m.id,
          autor_tipo: m.autor_tipo as MensagemPortal["autor_tipo"],
          autor_nome: m.autor_nome,
          texto: m.texto,
          interna: false,
          created_at: m.created_at,
          minha: m.autor_tipo === "cliente",
          nao_lida: m.autor_tipo === "escritorio" && !m.lida_pelo_cliente_em,
        }));
      }

      let q = supabase
        .from("portal_mensagens")
        .select("id, autor_tipo, autor_profile_id, autor_nome, texto, interna, created_at, lida_pela_equipe_em");
      if (escopo.entregaId) {
        // Fio de uma solicitação: a própria solicitação já define o projeto ou a obra.
        q = q.eq("entrega_id", escopo.entregaId);
      } else {
        // Painel geral: só as mensagens soltas do projeto ou da obra, sem as dos fios.
        q = escopo.projetoId ? q.eq("projeto_id", escopo.projetoId) : q.is("projeto_id", null);
        q = escopo.obraId ? q.eq("obra_id", escopo.obraId) : q.is("obra_id", null);
        q = q.is("entrega_id", null);
      }
      const { data, error } = await q.order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id,
        autor_tipo: m.autor_tipo as MensagemPortal["autor_tipo"],
        autor_nome: m.autor_nome,
        texto: m.texto,
        interna: m.interna,
        created_at: m.created_at,
        minha: m.autor_tipo === "escritorio" && m.autor_profile_id === user?.id,
        nao_lida: m.autor_tipo === "cliente" && !m.lida_pela_equipe_em,
      }));
    },
  });

  const enviar = useMutation({
    mutationFn: async ({ texto, interna }: { texto: string; interna: boolean }) => {
      if (lado === "cliente") {
        const token = getPortalToken();
        if (!token) throw new Error("Sessão inválida");
        const { error } = await supabase.rpc("portal_enviar_mensagem", {
          p_token: token,
          p_texto: texto,
          ...argsRpc(escopo),
        });
        if (error) throw error;
        return;
      }

      if (!profile?.empresa_id || !user) throw new Error("Sem empresa");
      const id = crypto.randomUUID();
      const { error } = await supabase.from("portal_mensagens").insert({
        id,
        empresa_id: profile.empresa_id,
        projeto_id: escopo.projetoId ?? null,
        obra_id: escopo.obraId ?? null,
        entrega_id: escopo.entregaId ?? null,
        autor_tipo: "escritorio",
        autor_profile_id: user.id,
        autor_nome: profile.nome ?? profile.first_name ?? "Escritório",
        texto,
        interna,
      });
      if (error) throw error;
      // O e-mail ao cliente é complemento e sai agrupado: falhar aqui não desfaz a mensagem.
      if (!interna) void supabase.functions.invoke("portal-avisar-mensagem", { body: { mensagem_id: id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-mensagens"] }),
  });

  const lidas = useMutation({
    mutationFn: async () => {
      if (lado === "cliente") {
        const token = getPortalToken();
        if (!token) return;
        const { error } = await supabase.rpc("portal_marcar_mensagens_lidas", { p_token: token, ...argsRpc(escopo) });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.rpc("marcar_mensagens_portal_lidas_equipe", argsRpc(escopo));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-mensagens"] }),
  });

  // Conversa aberta e com mensagem da outra parte ainda não vista: marca como lida uma vez por lote.
  const temNaoLida = (mensagens.data ?? []).some((m) => m.nao_lida);
  const marcarLidas = lidas.mutate;
  useEffect(() => {
    if (ativo && temNaoLida) marcarLidas();
  }, [ativo, temNaoLida, marcarLidas]);

  return { mensagens, enviar, key };
}

/** Não lidas do cliente por conversa (alimenta o ponto do botão e o contador de cada solicitação). */
export function useNaoLidasCliente() {
  return useQuery({
    queryKey: ["portal-mensagens-nao-lidas"],
    refetchInterval: INTERVALO_MS,
    queryFn: async () => {
      const token = getPortalToken();
      if (!token) return [];
      const { data, error } = await supabase.rpc("portal_contar_mensagens_nao_lidas", { p_token: token });
      if (error) throw error;
      return data ?? [];
    },
  });
}
