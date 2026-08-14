import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FotoAssinada {
  id: string;
  url: string;
}

/**
 * Fotos do diário de uma obra, agrupadas por rdo_id e já com URL assinada
 * (bucket privado `obra-campo`). O escritório (autenticado) passa no RLS do
 * Storage porque o 1º segmento do path é o empresa_id.
 */
export function useObraFotos(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_fotos", obraId],
    enabled: !!obraId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Record<string, FotoAssinada[]>> => {
      const { data, error } = await supabase
        .from("obra_rdo_foto")
        .select("id, rdo_id, path")
        .eq("obra_id", obraId!);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return {};

      const { data: signed } = await supabase.storage
        .from("obra-campo")
        .createSignedUrls(rows.map((r) => r.path), 3600);
      const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

      const byRdo: Record<string, FotoAssinada[]> = {};
      for (const r of rows) {
        const url = urlByPath.get(r.path);
        if (!url) continue;
        (byRdo[r.rdo_id] ??= []).push({ id: r.id, url });
      }
      return byRdo;
    },
  });
}
