import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listarPasta, pastaDoProjeto } from "@/lib/googleDrive";

export interface StatusDrive {
  conectado: boolean;
  email: string | null;
  conectadoEm: string | null;
}

export const CHAVE_STATUS_DRIVE = ["google-drive-status"] as const;

/** A empresa tem Google Drive conectado? (SPEC 162). Sem o token: só e-mail e data. */
export function useStatusDrive() {
  return useQuery({
    queryKey: CHAVE_STATUS_DRIVE,
    queryFn: async (): Promise<StatusDrive> => {
      const { data, error } = await supabase.rpc("get_google_drive_status");
      if (error) throw error;
      const linha = data?.[0];
      return {
        conectado: !!linha?.conectado,
        email: linha?.google_email ?? null,
        conectadoEm: linha?.conectado_em ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Pasta do projeto e das disciplinas; cria as que faltam se quem vê pode editar. */
export function usePastaDoProjeto(projetoId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ["google-drive-projeto", projetoId],
    queryFn: () => pastaDoProjeto(projetoId!),
    enabled: habilitado && !!projetoId,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useConteudoDaPasta(pastaId: string | undefined) {
  return useQuery({
    queryKey: ["google-drive-pasta", pastaId],
    queryFn: () => listarPasta(pastaId!),
    enabled: !!pastaId,
    staleTime: 30 * 1000,
    retry: false,
  });
}
