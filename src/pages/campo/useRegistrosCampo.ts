import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { temOrganizacaoEmCurso } from "@/lib/registrosObra";
import { getCampoToken } from "./useCampoAuth";
import type { RegistroDoServidor } from "./registrosView";

interface RespostaListagem {
  registros: RegistroDoServidor[];
  aceitouAudio: boolean;
}

/**
 * Registros da obra do campo (SPEC 135). Enquanto algum está sendo organizado pela IA a lista
 * se atualiza sozinha a cada 4 s, então o texto e os chips aparecem sem a pessoa fazer nada.
 */
export function useRegistrosCampo(accountId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["campo_registros", accountId],
    queryFn: async (): Promise<RespostaListagem> => {
      const token = getCampoToken();
      if (!token) return { registros: [], aceitouAudio: false };
      const { data, error } = await supabase.rpc("campo_listar_registros", { p_token: token, p_limite: 60 });
      if (error) throw error;
      const r = data as unknown as { ok: boolean; registros?: RegistroDoServidor[]; aceitou_audio?: boolean };
      return r?.ok
        ? { registros: r.registros ?? [], aceitouAudio: Boolean(r.aceitou_audio) }
        : { registros: [], aceitouAudio: false };
    },
    staleTime: 15_000,
    refetchInterval: (q) => (temOrganizacaoEmCurso(q.state.data?.registros ?? []) ? 4000 : false),
  });

  const atualizar = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["campo_registros", accountId] }),
    [queryClient, accountId]
  );

  /** "Tentar de novo" num registro que a IA não organizou. */
  const reprocessar = useMutation({
    mutationFn: async (registroId: string) => {
      const token = getCampoToken();
      if (!token) throw new Error("Sessão vencida");
      const { error } = await supabase.functions.invoke("registro-reprocessar", {
        body: { registro_id: registroId, token },
      });
      if (error) throw error;
    },
    // A edge responde 202 e organiza em segundo plano: dá um instante e volta a olhar a lista.
    onSuccess: () => setTimeout(atualizar, 1200),
  });

  /** Resposta à pergunta "Quantas pessoas trabalharam hoje?". */
  const responderEfetivo = useMutation({
    mutationFn: async ({ registroId, quantidade }: { registroId: string; quantidade: number }) => {
      const token = getCampoToken();
      if (!token) throw new Error("Sessão vencida");
      const { data, error } = await supabase.rpc("campo_responder_efetivo", {
        p_token: token,
        p_registro_id: registroId,
        p_quantidade: quantidade,
      });
      if (error || !(data as unknown as { ok?: boolean } | null)?.ok) throw error ?? new Error("Não deu para salvar");
    },
    onSuccess: atualizar,
  });

  return {
    ...query,
    servidor: query.data?.registros ?? [],
    aceitouAudio: query.data?.aceitouAudio ?? false,
    reprocessar,
    responderEfetivo,
  };
}
