import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BaldePosicao = "vencidos" | "hoje" | "semana" | "futuro" | "pagos_mes";

export interface TitulosPosicao {
  baldes: Record<BaldePosicao, { qtd: number; valor: number }>;
  /** "Hoje" no fuso do servidor (America/Sao_Paulo), base dos intervalos dos chips. */
  hoje: string;
}

const BALDES: BaldePosicao[] = ["vencidos", "hoje", "semana", "futuro", "pagos_mes"];

/**
 * Posição dos títulos de um tipo (a receber ou a pagar) por vencimento, sobre o conjunto
 * inteiro (get_titulos_posicao). Alimenta os chips do topo das abas A receber / A pagar.
 */
export function useTitulosPosicao(tipo: "receita" | "despesa" | null) {
  return useQuery({
    queryKey: ["titulos-posicao", tipo],
    enabled: tipo !== null,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<TitulosPosicao> => {
      const { data, error } = await supabase.rpc("get_titulos_posicao", { p_tipo: tipo as string });
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, { qtd?: number; valor?: number } | string>;
      const baldes = {} as TitulosPosicao["baldes"];
      for (const b of BALDES) {
        const v = raw[b] as { qtd?: number; valor?: number } | undefined;
        baldes[b] = { qtd: Number(v?.qtd ?? 0), valor: Number(v?.valor ?? 0) };
      }
      return { baldes, hoje: typeof raw.hoje_data === "string" ? raw.hoje_data : "" };
    },
  });
}
