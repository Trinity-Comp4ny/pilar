import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ResultadoRdoTarefa = "avancou" | "concluiu" | "parou";

export type RdoTarefaRow = Tables<"obra_rdo_tarefa">;

/** Linha da ponte já com título/estado da tarefa e o rdo_id para agrupar por dia. */
export interface RdoTarefaJoin {
  id: string;
  rdo_id: string;
  tarefa_id: string;
  resultado: ResultadoRdoTarefa;
  observacao: string | null;
  tarefa: { id: string; titulo: string; status: string } | null;
}

const key = (obraId: string) => ["obra_rdo_tarefa", obraId] as const;

/**
 * Todos os vínculos diário↔tarefa de uma obra (via join com obra_rdo para
 * filtrar por obra_id). Serve o card do dia no diário: agrupar por rdo_id.
 */
export function useObraRdoTarefas(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_rdo_tarefa", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<RdoTarefaJoin[]> => {
      const { data, error } = await supabase
        .from("obra_rdo_tarefa")
        .select("id, rdo_id, tarefa_id, resultado, observacao, tarefa:tarefas(id, titulo, status), obra_rdo!inner(obra_id)")
        .eq("obra_rdo.obra_id", obraId!)
        .returns<RdoTarefaJoin[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export interface EntradaRdoTarefa {
  tarefa_id: string;
  resultado: ResultadoRdoTarefa;
  observacao?: string | null;
}

/**
 * Sincroniza os vínculos de um RDO com as tarefas reportadas e aplica o efeito
 * no cronograma: `concluiu` fecha a tarefa (status = concluida), `parou` a
 * sinaliza. Substitui o conjunto de vínculos do dia (remove os que saíram,
 * grava os atuais). É o passo que faz o diário manter o cronograma vivo.
 */
export function useSaveRdoTarefas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rdoId,
      entradas,
    }: {
      rdoId: string;
      obraId: string;
      entradas: EntradaRdoTarefa[];
    }): Promise<void> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      // Substitui o conjunto do dia: apaga os vínculos atuais e regrava.
      const { error: delErr } = await supabase.from("obra_rdo_tarefa").delete().eq("rdo_id", rdoId);
      if (delErr) throw delErr;

      if (entradas.length > 0) {
        const rows = entradas.map((e) => ({
          empresa_id: empresaId,
          rdo_id: rdoId,
          tarefa_id: e.tarefa_id,
          resultado: e.resultado,
          observacao: e.observacao?.trim() || null,
        }));
        const { error: insErr } = await supabase.from("obra_rdo_tarefa").insert(rows);
        if (insErr) throw insErr;
      }

      // Efeito no cronograma. Concluir fecha; parar sinaliza; avançar limpa a
      // sinalização (voltou a andar). Feito por tarefa para respeitar o RLS.
      const concluidas = entradas.filter((e) => e.resultado === "concluiu").map((e) => e.tarefa_id);
      const paradas = entradas.filter((e) => e.resultado === "parou").map((e) => e.tarefa_id);
      const andando = entradas.filter((e) => e.resultado === "avancou").map((e) => e.tarefa_id);

      if (concluidas.length > 0) {
        const { error } = await supabase
          .from("tarefas")
          .update({ status: "concluida", sinalizada: false })
          .in("id", concluidas);
        if (error) throw error;
      }
      if (paradas.length > 0) {
        const { error } = await supabase.from("tarefas").update({ sinalizada: true }).in("id", paradas);
        if (error) throw error;
      }
      if (andando.length > 0) {
        const { error } = await supabase.from("tarefas").update({ sinalizada: false }).in("id", andando);
        if (error) throw error;
      }
    },
    onSuccess: (_data, { obraId }) => {
      qc.invalidateQueries({ queryKey: key(obraId) });
      qc.invalidateQueries({ queryKey: ["obra_tarefas", obraId] });
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
  });
}
