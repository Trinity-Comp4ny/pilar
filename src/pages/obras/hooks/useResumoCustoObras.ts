import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realizadoPorEtapa, SEM_ETAPA } from "@/lib/obras";
import { montarOrcadoRealizado, type NoFinanceiro } from "@/lib/orcadoRealizado";
import type { ResumoCusto } from "@/pages/obras/lib/semaforoCusto";

/** Previsto e realizado de cada obra da empresa, para o semáforo dos cards. Três consultas, sem N+1. */
export function useResumoCustoObras() {
  return useQuery({
    queryKey: ["obras", "resumo-custo"],
    queryFn: async (): Promise<Map<string, ResumoCusto>> => {
      const [nos, orcamentos, lancamentos] = await Promise.all([
        supabase.from("obra_frente").select("id, obra_id, parent_id, nivel, nome, ordem, created_at"),
        supabase.from("obra_orcamento_etapa").select("obra_id, obra_frente_id, valor_previsto"),
        supabase.from("obra_conta_lancamento").select("obra_id, tipo, valor, obra_frente_id").eq("tipo", "despesa"),
      ]);
      if (nos.error) throw nos.error;
      if (orcamentos.error) throw orcamentos.error;
      if (lancamentos.error) throw lancamentos.error;

      const porObra = <T extends { obra_id: string }>(linhas: T[] | null) => {
        const m = new Map<string, T[]>();
        for (const l of linhas ?? []) m.set(l.obra_id, [...(m.get(l.obra_id) ?? []), l]);
        return m;
      };
      const nosPorObra = porObra(nos.data);
      const orcPorObra = porObra(orcamentos.data);
      const lancPorObra = porObra(lancamentos.data);

      const resumo = new Map<string, ResumoCusto>();
      for (const obraId of new Set([...nosPorObra.keys(), ...lancPorObra.keys()])) {
        const previsto = new Map<string, number>();
        for (const o of orcPorObra.get(obraId) ?? []) previsto.set(o.obra_frente_id, Number(o.valor_previsto));
        const realizado = realizadoPorEtapa(lancPorObra.get(obraId) ?? []);
        const arvore = montarOrcadoRealizado(
          (nosPorObra.get(obraId) ?? []) as NoFinanceiro[],
          previsto,
          realizado,
          realizado[SEM_ETAPA] ?? 0
        );
        resumo.set(obraId, { previsto: arvore.totalPrevisto, realizado: arvore.totalRealizado });
      }
      return resumo;
    },
    staleTime: 1000 * 60 * 3,
  });
}
