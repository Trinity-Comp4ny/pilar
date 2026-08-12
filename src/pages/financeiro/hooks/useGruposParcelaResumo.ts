import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GrupoParcelaResumo {
  totalOriginal: number;
  totalPago: number;
  saldo: number;
  pagas: number;
  totalParcelas: number;
  proximaVenc: string | null;
  proximaValor: number | null;
  status: "aberto" | "parcial" | "quitado";
}

/**
 * Resumo do PLANO inteiro de cada grupo de parcela (total, pago, saldo, k/N,
 * próxima parcela), independente do período exibido. Alimenta a linha-grupo para
 * ela parar de mostrar fragmento como total (spec 033). Retorna um mapa por grupo.
 */
export function useGruposParcelaResumo(grupoIds: string[]) {
  const sorted = [...new Set(grupoIds)].sort();

  const { data } = useQuery({
    queryKey: ["grupos-parcela-resumo", sorted],
    enabled: sorted.length > 0,
    queryFn: async (): Promise<Map<string, GrupoParcelaResumo>> => {
      const { data, error } = await supabase.rpc("get_grupos_parcela_resumo", {
        p_grupo_ids: sorted,
      });
      if (error) throw error;
      const map = new Map<string, GrupoParcelaResumo>();
      for (const row of (data ?? []) as Record<string, number | string | null>[]) {
        map.set(String(row.grupo_parcela), {
          totalOriginal: Number(row.total_original ?? 0),
          totalPago: Number(row.total_pago ?? 0),
          saldo: Number(row.saldo ?? 0),
          pagas: Number(row.pagas ?? 0),
          totalParcelas: Number(row.total_parcelas ?? 0),
          proximaVenc: (row.proxima_venc as string | null) ?? null,
          proximaValor: row.proxima_valor == null ? null : Number(row.proxima_valor),
          status: (row.status as GrupoParcelaResumo["status"]) ?? "aberto",
        });
      }
      return map;
    },
    staleTime: 30 * 1000,
  });

  return data ?? new Map<string, GrupoParcelaResumo>();
}
