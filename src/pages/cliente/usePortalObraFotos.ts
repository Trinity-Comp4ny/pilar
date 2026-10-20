import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";

/**
 * URLs assinadas (5min) das fotos do diário curado da obra (spec 087) — o
 * portal não tem sessão Supabase autenticada, resolve via edge function
 * própria (`portal-obra-fotos`), em lote. `fotoIds` vazio não chama a rede.
 */
export function usePortalObraFotos(fotoIds: string[]) {
  const key = [...fotoIds].sort().join(",");
  return useQuery({
    queryKey: ["portal_obra_fotos", key],
    enabled: fotoIds.length > 0,
    staleTime: 1000 * 60 * 4, // signed URL dura 5min; renova um pouco antes
    queryFn: async (): Promise<Record<string, string>> => {
      const token = getPortalToken();
      if (!token) return {};
      const { data, error } = await supabase.functions.invoke("portal-obra-fotos", {
        body: { session_token: token, foto_ids: fotoIds },
      });
      if (error) throw error;
      const fotos = (data as { fotos?: Array<{ id: string; signed_url: string }> } | null)?.fotos ?? [];
      return Object.fromEntries(fotos.map((f) => [f.id, f.signed_url]));
    },
  });
}

/**
 * URLs assinadas das fotos dos registros liberados ao cliente (SPEC 135, fase C), pela mesma edge
 * (`portal-obra-fotos`), que revalida cada registro contra a sessão. Devolve registro_id → urls.
 */
export function usePortalRegistroFotos(registroIds: string[]) {
  const key = [...registroIds].sort().join(",");
  return useQuery({
    queryKey: ["portal_registro_fotos", key],
    enabled: registroIds.length > 0,
    staleTime: 1000 * 60 * 4,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const token = getPortalToken();
      if (!token) return {};
      const { data, error } = await supabase.functions.invoke("portal-obra-fotos", {
        body: { session_token: token, registro_ids: registroIds },
      });
      if (error) throw error;
      const lista =
        (data as { registro_fotos?: Array<{ registro_id: string; urls: string[] }> } | null)?.registro_fotos ?? [];
      return Object.fromEntries(lista.map((r) => [r.registro_id, r.urls]));
    },
  });
}
