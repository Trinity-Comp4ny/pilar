import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  JANELA_NORMALIZADO_MS,
  montarAvisos,
  type Aviso,
  type IncidenteAviso,
  type ManutencaoAviso,
  type Severidade,
} from "@/lib/avisosPlataforma";

export const AVISOS_PLATAFORMA_KEY = ["avisos-plataforma"] as const;

interface Dados {
  incidentes: IncidenteAviso[];
  manutencoes: ManutencaoAviso[];
}

async function buscar(): Promise<Dados> {
  const agora = Date.now();
  const desde = new Date(agora - JANELA_NORMALIZADO_MS).toISOString();
  const [incidentes, manutencoes] = await Promise.all([
    supabase
      .from("status_incidents")
      .select(
        "id, titulo, severidade, status, resolved_at, status_incident_components(status_components(nome_exibicao, ordem)), status_incident_updates(id, mensagem, created_at)"
      )
      .or(`status.neq.resolvido,resolved_at.gte.${desde}`),
    supabase
      .from("status_manutencoes")
      .select("id, titulo, mensagem, inicio, fim, cancelada_em")
      .is("cancelada_em", null)
      .gt("fim", new Date(agora).toISOString())
      .order("inicio"),
  ]);
  if (incidentes.error) throw incidentes.error;
  if (manutencoes.error) throw manutencoes.error;

  return {
    incidentes: (incidentes.data ?? []).map((i) => {
      const ultima = [...(i.status_incident_updates ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        id: i.id,
        titulo: i.titulo,
        severidade: i.severidade as Severidade,
        status: i.status,
        resolvidoEm: i.resolved_at,
        componentes: (i.status_incident_components ?? [])
          .map((c) => c.status_components)
          .filter((c): c is { nome_exibicao: string; ordem: number } => !!c)
          .sort((a, b) => a.ordem - b.ordem)
          .map((c) => c.nome_exibicao),
        ultimaAtualizacao: ultima ? { id: ultima.id, mensagem: ultima.mensagem } : null,
      };
    }),
    manutencoes: (manutencoes.data ?? []).map((m) => ({
      id: m.id,
      titulo: m.titulo,
      mensagem: m.mensagem,
      inicio: m.inicio,
      fim: m.fim,
      canceladaEm: m.cancelada_em,
    })),
  };
}

/**
 * Incidentes e manutenções declarados no Ultra admin, como avisos para a faixa do app (SPEC 153).
 * Consulta a cada minuto com a aba visível; em segundo plano não consulta.
 */
export function useAvisosPlataforma(): Aviso[] {
  const { user } = useAuth();
  const { data, dataUpdatedAt } = useQuery({
    queryKey: AVISOS_PLATAFORMA_KEY,
    queryFn: buscar,
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return useMemo(
    () => (data ? montarAvisos(data.incidentes, data.manutencoes, new Date(dataUpdatedAt || Date.now())) : []),
    [data, dataUpdatedAt]
  );
}
