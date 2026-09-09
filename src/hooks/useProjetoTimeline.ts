import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProjetoTimelineTipo =
  | "projeto_iniciado"
  | "projeto_concluido"
  | "status_alterado"
  | "disciplina_iniciada"
  | "disciplina_concluida"
  | "pausa_iniciada"
  | "pausa_retomada"
  | "revisao_registrada"
  | "revisao_concluida"
  | "escopo_alterado"
  | "portal_proposta_aprovada"
  | "portal_entrega_aprovada"
  | "portal_entrega_revisao_solicitada";

export interface ProjetoTimelineEvento {
  disciplinaId: string | null;
  disciplinaNome: string | null;
  tipo: ProjetoTimelineTipo;
  ocorridoEm: string;
  detalhe: string | null;
  autorNome: string | null;
}

interface TimelineRow {
  disciplina_id: string | null;
  disciplina_nome: string | null;
  tipo: string;
  ocorrido_em: string;
  detalhe: string | null;
  autor_nome: string | null;
}

/** Feed cronológico do projeto: v_projeto_timeline (spec 093 PR 2), mais recente primeiro. */
export function useProjetoTimeline(projetoId: string | undefined) {
  return useQuery({
    queryKey: ["projeto-timeline", projetoId],
    queryFn: async () => {
      if (!projetoId) return [] as ProjetoTimelineEvento[];
      // gen:types não inclui v_projeto_timeline ainda.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("v_projeto_timeline")
        .select("disciplina_id, disciplina_nome, tipo, ocorrido_em, detalhe, autor_nome")
        .eq("projeto_id", projetoId)
        .order("ocorrido_em", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as TimelineRow[]).map((row): ProjetoTimelineEvento => ({
        disciplinaId: row.disciplina_id,
        disciplinaNome: row.disciplina_nome,
        tipo: row.tipo as ProjetoTimelineTipo,
        ocorridoEm: row.ocorrido_em,
        detalhe: row.detalhe,
        autorNome: row.autor_nome,
      }));
    },
    enabled: !!projetoId,
  });
}
