import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import type { MeioRecebimento } from "@/lib/margemLiquida";

export interface ConfigComercial {
  aliquotaImpostoPct: number;
  margemMinimaPct: number;
  margemAlvoPct: number;
  meiosRecebimento: MeioRecebimento[];
}

/** Padrão quando a empresa ainda não configurou: sem imposto, sem taxa. */
export const CONFIG_COMERCIAL_PADRAO: ConfigComercial = {
  aliquotaImpostoPct: 0,
  margemMinimaPct: 15,
  margemAlvoPct: 30,
  meiosRecebimento: [
    { id: "pix", nome: "PIX ou transferência", taxa_pct: 0 },
    { id: "boleto", nome: "Boleto", taxa_pct: 0 },
    { id: "cartao", nome: "Cartão de crédito", taxa_pct: 0, faixas: { "1": 0, "2": 0, "7": 0 } },
  ],
};

const parseMeios = (raw: Json): MeioRecebimento[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const m = item as Record<string, Json>;
    if (typeof m.id !== "string" || typeof m.nome !== "string") return [];
    const faixas =
      m.faixas && typeof m.faixas === "object" && !Array.isArray(m.faixas)
        ? Object.fromEntries(Object.entries(m.faixas as Record<string, Json>).map(([k, v]) => [k, Number(v) || 0]))
        : undefined;
    return [{ id: m.id, nome: m.nome, taxa_pct: Number(m.taxa_pct) || 0, ...(faixas ? { faixas } : {}) }];
  });
};

/** Lê os parâmetros comerciais. Só quem tem acesso ao financeiro consegue (RLS). */
export function useConfigComercial(enabled = true) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;

  return useQuery({
    queryKey: ["empresa-config-comercial", empresaId],
    enabled: enabled && !!empresaId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<ConfigComercial> => {
      const { data, error } = await supabase
        .from("empresa_config_comercial")
        .select("aliquota_imposto_pct, margem_minima_pct, margem_alvo_pct, meios_recebimento")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return CONFIG_COMERCIAL_PADRAO;
      const meios = parseMeios(data.meios_recebimento);
      return {
        aliquotaImpostoPct: Number(data.aliquota_imposto_pct),
        margemMinimaPct: Number(data.margem_minima_pct),
        margemAlvoPct: Number(data.margem_alvo_pct),
        meiosRecebimento: meios.length > 0 ? meios : CONFIG_COMERCIAL_PADRAO.meiosRecebimento,
      };
    },
  });
}

/** Grava (upsert) os parâmetros comerciais da empresa. */
export function useSalvarConfigComercial() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;

  return useMutation({
    mutationFn: async (config: ConfigComercial) => {
      if (!empresaId) throw new Error("Usuário sem empresa");
      const { error } = await supabase.from("empresa_config_comercial").upsert({
        empresa_id: empresaId,
        aliquota_imposto_pct: config.aliquotaImpostoPct,
        margem_minima_pct: config.margemMinimaPct,
        margem_alvo_pct: config.margemAlvoPct,
        meios_recebimento: config.meiosRecebimento as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresa-config-comercial", empresaId] }),
  });
}
