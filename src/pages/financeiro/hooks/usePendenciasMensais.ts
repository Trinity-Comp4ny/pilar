import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PendenciaMes {
  /** Chave AAAA-MM, usada para ordenar. */
  chave: string;
  mes: string;
  aReceber: number;
  aPagar: number;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Linha = { tipo: string; valor: number; data_vencimento: string; status: string };

// A receber e a pagar por mês de vencimento (pendentes e atrasados), a partir do mês
// anterior ao atual até `meses` à frente. Independe do filtro de período da tela.
export function usePendenciasMensais(meses = 6) {
  return useQuery({
    queryKey: ["financeiro-pendencias-mensais", meses],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PendenciaMes[]> => {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + meses, 0);
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("lancamentos")
        .select("tipo, valor, data_vencimento, status")
        .in("tipo", ["receita", "despesa"])
        .not("status", "in", "(Recebido,Pago)")
        .gte("data_vencimento", iso(inicio))
        .lte("data_vencimento", iso(fim));
      if (error) throw error;

      const mapa = new Map<string, PendenciaMes>();
      for (let i = -1; i < meses; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        mapa.set(chave, {
          chave,
          mes: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
          aReceber: 0,
          aPagar: 0,
        });
      }
      for (const r of (data ?? []) as unknown as Linha[]) {
        const item = mapa.get(r.data_vencimento.slice(0, 7));
        if (!item) continue;
        if (r.tipo === "receita") item.aReceber += Number(r.valor || 0);
        else item.aPagar += Number(r.valor || 0);
      }
      return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave));
    },
  });
}
