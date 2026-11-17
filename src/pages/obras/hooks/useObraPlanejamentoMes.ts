import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { MesChave, PlanejamentoManual } from "@/pages/obras/lib/fisicoFinanceiro";

// Planejamento mensal manual do físico-financeiro (spec 165). Um nó é "manual" se e somente se tem linha aqui.

export type ObraPlanejamentoMesRow = Tables<"obra_planejamento_mes">;

const chave = (obraId: string | undefined) => ["obra_planejamento_mes", obraId] as const;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Todas as células manuais da obra (uma consulta). */
export function useObraPlanejamentoMes(obraId: string | undefined) {
  return useQuery({
    queryKey: chave(obraId),
    enabled: !!obraId,
    queryFn: async (): Promise<ObraPlanejamentoMesRow[]> => {
      const { data, error } = await supabase.from("obra_planejamento_mes").select("*").eq("obra_id", obraId!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Linhas do banco ("2026-11-01", 51.6129) no formato da grade: nó → { "2026-11": 51.6129 }. */
export function agruparPlanejamentoManual(linhas: ReadonlyArray<ObraPlanejamentoMesRow>): PlanejamentoManual {
  const porNo = new Map<string, Record<MesChave, number>>();
  for (const l of linhas) {
    const atual = porNo.get(l.obra_frente_id) ?? {};
    atual[l.mes.slice(0, 7)] = Number(l.percentual);
    porNo.set(l.obra_frente_id, atual);
  }
  return porNo;
}

/**
 * Grava de uma vez todos os meses de um nó (o nó nunca fica meio manual) e depois remove os meses que sobraram
 * no banco e não estão mais na grade. Percentual de 0 a 100 por mês.
 */
export function useSalvarPlanejamentoNo(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      obraFrenteId,
      percentuais,
    }: {
      obraFrenteId: string;
      percentuais: Readonly<Record<MesChave, number>>;
    }): Promise<void> => {
      const meses = Object.keys(percentuais);
      if (meses.length === 0) throw new Error("Informe ao menos um mês");
      for (const mes of meses) {
        const pct = percentuais[mes];
        if (!MES.test(mes)) throw new Error(`Mês inválido: ${mes}`);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error("O percentual de cada mês vai de 0 a 100");
      }

      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      const { error } = await supabase.from("obra_planejamento_mes").upsert(
        meses.map((mes) => ({
          empresa_id: empresaId,
          obra_id: obraId,
          obra_frente_id: obraFrenteId,
          mes: `${mes}-01`,
          percentual: percentuais[mes],
        })),
        { onConflict: "obra_id,obra_frente_id,mes" }
      );
      if (error) throw error;

      const { error: errLimpeza } = await supabase
        .from("obra_planejamento_mes")
        .delete()
        .eq("obra_id", obraId)
        .eq("obra_frente_id", obraFrenteId)
        .not("mes", "in", `(${meses.map((m) => `${m}-01`).join(",")})`);
      if (errLimpeza) throw errLimpeza;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chave(obraId) }),
  });
}

/** "Voltar ao automático": apaga o planejamento manual do nó e a grade volta a seguir o cronograma. */
export function useVoltarAoAutomatico(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obraFrenteId: string): Promise<void> => {
      const { error } = await supabase
        .from("obra_planejamento_mes")
        .delete()
        .eq("obra_id", obraId)
        .eq("obra_frente_id", obraFrenteId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chave(obraId) }),
  });
}
