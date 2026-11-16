import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { aplicarPlanoFluxoNoProjeto } from "@/hooks/useProjetoDisciplinas";
import { formatDateLocal } from "@/lib/businessDays";
import { dataInicioPadraoFluxo, planejarAplicacaoFluxo, type PlanoAplicacaoFluxo } from "@/lib/fluxoCascata";
import type { FluxoDisciplinaTemplate } from "@/types/fluxoDisciplinas";

export interface SincronizacaoDoProjeto {
  projeto: { id: string; nome: string };
  plano: PlanoAplicacaoFluxo;
  /** Disciplinas que já existem e mudariam de coluna porque o fluxo mudou. */
  mudamDeColuna: number;
  temAlgo: boolean;
}

/** Liga o projeto ao fluxo que ele segue (é o que permite achar os projetos quando o fluxo muda). */
export async function vincularProjetoAoFluxo(projetoId: string, fluxoId: string | null) {
  const { error } = await supabase
    .from("projetos")
    .update({ fluxo_id: fluxoId } as never)
    .eq("id", projetoId);
  if (error) throw error;
}

/** Para cada projeto que segue o fluxo: disciplinas novas que entrariam e as que mudariam de coluna. */
export function useSincronizacoesDoFluxoProjetos(
  fluxoId: string | null,
  disciplinasDoFluxo: FluxoDisciplinaTemplate[],
  enabled: boolean
) {
  return useQuery({
    queryKey: ["fluxo-projetos-sincronizacoes", fluxoId, disciplinasDoFluxo],
    enabled: enabled && !!fluxoId,
    staleTime: 0,
    queryFn: async (): Promise<SincronizacaoDoProjeto[]> => {
      const { data: projetos, error } = await supabase
        .from("projetos")
        .select("id, nome, data_inicio")
        .eq("fluxo_id" as never, fluxoId!)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;

      return Promise.all(
        ((projetos ?? []) as unknown as { id: string; nome: string; data_inicio: string | null }[]).map(async (p) => {
          const { data: discs, error: dErr } = await supabase
            .from("projeto_disciplinas")
            .select("id, nome, ordem_etapa")
            .eq("projeto_id", p.id);
          if (dErr) throw dErr;
          const existentes = discs ?? [];
          const plano = planejarAplicacaoFluxo(
            disciplinasDoFluxo,
            existentes,
            dataInicioPadraoFluxo(p.data_inicio ?? undefined, formatDateLocal(new Date()))
          );
          const ordemAtual = new Map(existentes.map((d) => [d.id, d.ordem_etapa]));
          const mudamDeColuna = plano.encaixadas.filter((e) => ordemAtual.get(e.id) !== e.ordem_etapa).length;
          return {
            projeto: { id: p.id, nome: p.nome },
            plano: { ...plano, encaixadas: plano.encaixadas.filter((e) => ordemAtual.get(e.id) !== e.ordem_etapa) },
            mudamDeColuna,
            temAlgo: plano.novas.length > 0 || mudamDeColuna > 0,
          };
        })
      );
    },
  });
}

/** Atualiza os projetos escolhidos. Um que falha não impede os outros: o resultado diz quais deram certo. */
export function useAplicarSincronizacoesProjetos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lista: SincronizacaoDoProjeto[]) => {
      const falhas: string[] = [];
      let ok = 0;
      for (const item of lista) {
        try {
          await aplicarPlanoFluxoNoProjeto(item.projeto.id, item.plano);
          ok += 1;
        } catch {
          falhas.push(item.projeto.nome);
        }
      }
      return { ok, falhas };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projeto-disciplinas"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["fluxo-projetos-sincronizacoes"] });
    },
  });
}
