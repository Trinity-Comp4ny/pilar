import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
  | "aditivo_criado"
  | "aditivo_rejeitado"
  | "aditivo_cobranca"
  | "aditivo_aceite"
  | "visita"
  | "suporte"
  | "portal_proposta_aprovada"
  | "portal_entrega_publicada"
  | "portal_entrega_aprovada"
  | "portal_entrega_revisao_solicitada"
  | "projeto_pausado"
  | "projeto_retomado"
  | "portal_acesso_concedido";

export interface ProjetoTimelineEvento {
  chave?: string;
  origemId?: string;
  disciplinaId: string | null;
  disciplinaNome: string | null;
  tipo: ProjetoTimelineTipo;
  ocorridoEm: string;
  detalhe: string | null;
  autorNome: string | null;
  dados?: Json;
}

type FiltrosHistorico = { disciplina?: string; tipo?: string; inicio?: string; fim?: string };
const POR_PAGINA = 30;

export function useProjetoTimeline(projetoId: string | undefined, filtros: FiltrosHistorico = {}) {
  const query = useInfiniteQuery<ProjetoTimelineEvento[]>({
    queryKey: ["projeto-timeline", projetoId, filtros],
    initialPageParam: 0,
    getNextPageParam: (ultima, paginas) => (ultima.length === POR_PAGINA ? paginas.length : undefined),
    queryFn: async ({ pageParam }): Promise<ProjetoTimelineEvento[]> => {
      if (!projetoId) return [];
      let consulta = supabase
        .from("v_projeto_historico")
        .select("chave, disciplina_id, disciplina_nome, tipo, ocorrido_em, detalhe, autor_nome, dados, origem_id")
        .eq("projeto_id", projetoId)
        .not("ocorrido_em", "is", null);
      if (filtros.disciplina) consulta = consulta.eq("disciplina_id", filtros.disciplina);
      if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo);
      if (filtros.inicio) consulta = consulta.gte("ocorrido_em", `${filtros.inicio}T00:00:00-03:00`);
      if (filtros.fim) consulta = consulta.lte("ocorrido_em", `${filtros.fim}T23:59:59.999999-03:00`);
      const primeiro = Number(pageParam) * POR_PAGINA;
      const { data, error } = await consulta
        .order("ocorrido_em", { ascending: false })
        .order("chave", { ascending: true })
        .range(primeiro, primeiro + POR_PAGINA - 1);
      if (error) throw error;
      return data.map((row) => ({
        chave: row.chave ?? undefined,
        origemId: row.origem_id ?? undefined,
        disciplinaId: row.disciplina_id,
        disciplinaNome: row.disciplina_nome,
        tipo: row.tipo as ProjetoTimelineTipo,
        ocorridoEm: row.ocorrido_em!,
        detalhe: row.detalhe,
        autorNome: row.autor_nome,
        dados: row.dados ?? undefined,
      }));
    },
    enabled: !!projetoId,
  });
  return { ...query, data: query.data?.pages.flat() };
}
