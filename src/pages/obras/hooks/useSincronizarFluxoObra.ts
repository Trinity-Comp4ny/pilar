import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EstruturaFluxo } from "@/pages/obras/lib/fluxoObra";
import {
  haAlgoParaSincronizar,
  planejarSincronizacao,
  type PlanoSincronizacao,
} from "@/pages/obras/lib/sincronizarFluxoObra";

interface ObraDoFluxo {
  id: string;
  nome: string;
  projeto_id: string | null;
  data_inicio_prevista: string | null;
}
export interface SincronizacaoDaObra {
  obra: ObraDoFluxo;
  plano: PlanoSincronizacao;
  temAlgo: boolean;
}

const hoje = () => new Date().toISOString().slice(0, 10);

/** Liga a obra ao fluxo que ela segue (é o que permite achar as obras quando o fluxo muda). */
export async function vincularObraAoFluxo(obraId: string, fluxoId: string | null) {
  const { error } = await supabase.from("obras").update({ fluxo_obra_id: fluxoId }).eq("id", obraId);
  if (error) throw error;
}

/** Para cada obra que segue o fluxo, o que entraria nela se o fluxo fosse reaplicado (só o que falta). */
export function useSincronizacoesDoFluxoObra(fluxoId: string | null, estrutura: EstruturaFluxo, enabled: boolean) {
  return useQuery({
    queryKey: ["fluxo-obra-sincronizacoes", fluxoId, estrutura],
    enabled: enabled && !!fluxoId,
    staleTime: 0,
    queryFn: async (): Promise<SincronizacaoDaObra[]> => {
      const { data: obras, error } = await supabase
        .from("obras")
        .select("id, nome, projeto_id, data_inicio_prevista")
        .eq("fluxo_obra_id", fluxoId!)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;

      return Promise.all(
        (obras ?? []).map(async (obra) => {
          const [nosRes, tarefasRes] = await Promise.all([
            supabase.from("obra_frente").select("*").eq("obra_id", obra.id),
            supabase.from("tarefas").select("obra_frente_id, titulo").eq("obra_id", obra.id),
          ]);
          if (nosRes.error) throw nosRes.error;
          if (tarefasRes.error) throw tarefasRes.error;
          const nos = nosRes.data ?? [];
          const inicio =
            obra.data_inicio_prevista ??
            nos
              .map((n) => n.data_inicio)
              .filter((v): v is string => !!v)
              .sort()[0] ??
            hoje();
          const plano = planejarSincronizacao(estrutura, nos, tarefasRes.data ?? [], inicio);
          return { obra, plano, temAlgo: haAlgoParaSincronizar(plano) };
        })
      );
    },
  });
}

async function gravarSincronizacao({ obra, plano }: SincronizacaoDaObra) {
  const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
  if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

  const ids = new Map(plano.nos.map((n) => [n.chave, crypto.randomUUID()]));
  const linhas = plano.nos.map((n) => ({
    id: ids.get(n.chave)!,
    empresa_id: empresaId,
    obra_id: obra.id,
    nome: n.nome,
    nivel: n.nivel,
    parent_id: n.paiId ?? (n.paiChave ? (ids.get(n.paiChave) ?? null) : null),
    ordem: n.ordem,
    data_inicio: n.inicio,
    data_fim: n.fim,
    fornecedor_id: n.fornecedorId,
  }));
  for (const nivel of ["fase", "etapa", "servico"] as const) {
    const doNivel = linhas.filter((l) => l.nivel === nivel);
    if (doNivel.length === 0) continue;
    const { error } = await supabase.from("obra_frente").insert(doNivel);
    if (error) throw error;
  }

  if (plano.tarefas.length > 0) {
    const { error } = await supabase.from("tarefas").insert(
      plano.tarefas.map((t) => ({
        empresa_id: empresaId,
        obra_id: obra.id,
        projeto_id: obra.projeto_id,
        obra_frente_id: t.servicoId ?? (t.servicoChave ? (ids.get(t.servicoChave) ?? null) : null),
        titulo: t.titulo,
        data_inicio: t.inicio,
        prazo: t.prazo,
      }))
    );
    if (error) throw error;
  }

  for (const p of plano.prestadores) {
    const { error } = await supabase.from("obra_frente").update({ fornecedor_id: p.fornecedor_id }).eq("id", p.id);
    if (error) throw error;
  }
  for (const p of plano.periodos) {
    const { error } = await supabase
      .from("obra_frente")
      .update({ data_inicio: p.inicio, data_fim: p.fim })
      .eq("id", p.id);
    if (error) throw error;
  }
}

/** Atualiza as obras escolhidas. Uma que falha não impede as outras: o resultado diz quais deram certo. */
export function useAplicarSincronizacoesObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lista: SincronizacaoDaObra[]) => {
      const falhas: string[] = [];
      let ok = 0;
      for (const item of lista) {
        try {
          await gravarSincronizacao(item);
          ok += 1;
        } catch {
          falhas.push(item.obra.nome);
        }
      }
      return { ok, falhas };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["obra_frente"] });
      qc.invalidateQueries({ queryKey: ["obra_tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["fluxo-obra-sincronizacoes"] });
    },
  });
}
