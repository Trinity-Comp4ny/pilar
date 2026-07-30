import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarPrevisao, climaPorCodigo, VENTO_FORTE_KMH } from "@/lib/clima";

export interface AlertaClima {
  obraId: string;
  obraNome: string;
  cidade: string | null;
  tipo: "chuva" | "vento";
  quando: string;
  label: string;
}

type ObraLocal = { id: string; nome: string; cidade: string | null; latitude: number; longitude: number };

const MAX_OBRAS = 10;

/**
 * Alertas de clima das obras com localização (chuva ou vento forte hoje/amanhã),
 * para o Radar da tela inicial. Só roda quando `enabled` (empresa tem Obras).
 */
export function useAlertasClimaObras(enabled: boolean) {
  const { data: obras = [] } = useQuery({
    queryKey: ["obras", "com-local"],
    enabled,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<ObraLocal[]> => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome, cidade, latitude, longitude")
        .is("deleted_at", null)
        .not("latitude", "is", null)
        .limit(MAX_OBRAS);
      if (error) throw error;
      return (data ?? []) as ObraLocal[];
    },
  });

  const results = useQueries({
    queries: obras.map((o) => ({
      queryKey: ["clima", o.latitude, o.longitude],
      queryFn: () => buscarPrevisao(o.latitude, o.longitude),
      enabled,
      staleTime: 1000 * 60 * 30,
    })),
  });

  const alertas = useMemo(() => {
    const out: AlertaClima[] = [];
    results.forEach((r, i) => {
      const o = obras[i];
      if (!o || !r.data) return;
      const proximos = r.data.dias.slice(0, 2); // hoje + amanhã
      const rotulo = (idx: number) => (idx === 0 ? "hoje" : "amanhã");

      const chuvaIdx = proximos.findIndex((d) => d.chuvaProb >= 60 || climaPorCodigo(d.code).chuva);
      if (chuvaIdx >= 0) {
        const d = proximos[chuvaIdx];
        out.push({
          obraId: o.id,
          obraNome: o.nome,
          cidade: o.cidade,
          tipo: "chuva",
          quando: rotulo(chuvaIdx),
          label: `chuva ${rotulo(chuvaIdx)} (${d.chuvaProb}%)`,
        });
      }

      const ventoIdx = proximos.findIndex((d) => d.ventoMax >= VENTO_FORTE_KMH);
      if (ventoIdx >= 0) {
        const d = proximos[ventoIdx];
        out.push({
          obraId: o.id,
          obraNome: o.nome,
          cidade: o.cidade,
          tipo: "vento",
          quando: rotulo(ventoIdx),
          label: `vento ${d.ventoMax} km/h ${rotulo(ventoIdx)}`,
        });
      }
    });
    return out;
  }, [results, obras]);

  const isLoading = enabled && obras.length > 0 && results.some((r) => r.isLoading);
  return { alertas, isLoading };
}
