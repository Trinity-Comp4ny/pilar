import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento } from "./useLancamentosUnified";

const VAZIO = new Map<string, Lancamento[]>();

/**
 * Parcelas do PLANO inteiro de cada grupo, independente do período da tela (BEZ-442). A tabela
 * só traz as parcelas que caem no filtro; ao expandir o grupo, as de outros meses entram por aqui
 * para poderem ser vistas e editadas. A view `lancamentos` é security_invoker: a RLS isola a empresa.
 */
export function useParcelasDosGrupos(grupoIds: string[]) {
  const ids = useMemo(() => [...new Set(grupoIds)].sort(), [grupoIds]);

  const { data } = useQuery({
    queryKey: ["lancamentos-parcelas-dos-grupos", ids],
    enabled: ids.length > 0,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Map<string, Lancamento[]>> => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("*")
        .in("grupo_parcela", ids)
        .order("parcela_numero", { ascending: true });
      if (error) throw error;
      const porGrupo = new Map<string, Lancamento[]>();
      for (const r of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        const l = {
          ...(r as unknown as Lancamento),
          valor: Number(r.valor ?? 0),
          grupo_total_original: r.grupo_total_original == null ? null : Number(r.grupo_total_original),
        };
        porGrupo.set(l.grupo_parcela!, [...(porGrupo.get(l.grupo_parcela!) ?? []), l]);
      }
      return porGrupo;
    },
  });

  return data ?? VAZIO;
}
