import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EventoAgenda } from "@/lib/googleAgenda";

export interface StatusAgenda {
  conectado: boolean;
  email: string | null;
  conectadoEm: string | null;
  sincronizadoEm: string | null;
  /** O Google recusou o acesso: a pessoa precisa conectar de novo. */
  reconectar: boolean;
  /** Aviso padrão em minutos antes; null = não avisar. */
  lembreteMinutos: number | null;
}

export const CHAVE_STATUS_AGENDA = ["google-agenda-status"] as const;
export const CHAVE_EVENTOS_AGENDA = ["google-agenda-eventos"] as const;

/** A pessoa logada tem o Google Agenda conectado? (SPEC 164). */
export function useStatusAgenda() {
  return useQuery({
    queryKey: CHAVE_STATUS_AGENDA,
    queryFn: async (): Promise<StatusAgenda> => {
      const { data, error } = await supabase.rpc("get_google_agenda_status");
      if (error) throw error;
      const linha = data?.[0];
      return {
        conectado: !!linha?.conectado,
        email: linha?.google_email ?? null,
        conectadoEm: linha?.conectado_em ?? null,
        sincronizadoEm: linha?.sincronizado_em ?? null,
        reconectar: linha?.erro === "reconectar",
        lembreteMinutos:
          linha?.lembrete_minutos === undefined || linha.lembrete_minutos === null
            ? 10
            : linha.lembrete_minutos < 0
              ? null
              : linha.lembrete_minutos,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Reuniões copiadas do Google da própria pessoa (a RLS só devolve as dela). */
export function useEventosAgenda(habilitado: boolean) {
  return useQuery({
    queryKey: CHAVE_EVENTOS_AGENDA,
    queryFn: async (): Promise<EventoAgenda[]> => {
      const { data, error } = await supabase
        .from("agenda_eventos_google")
        .select(
          "id, titulo, inicio, fim, dia_inteiro, local, descricao, convidados, link_reuniao, link_google, pode_editar, lembrete_minutos"
        )
        .order("inicio", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: habilitado,
    staleTime: 60 * 1000,
    // O cron ressincroniza de 10 em 10 min; a tela aberta acompanha.
    refetchInterval: 5 * 60 * 1000,
  });
}
