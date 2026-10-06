import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PerfilDisciplina {
  id: string;
  nome: string;
  status: string | null;
  prazo: string | null;
  projeto_id: string;
  projeto_nome: string;
}

export interface PerfilPublico {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  avatar_url: string | null;
  tem_conta: boolean;
  disciplinas: PerfilDisciplina[];
}

/** Perfil que qualquer membro da empresa pode ver de um colega (spec 103). */
export function usePerfilPublico(pessoaId: string | null) {
  return useQuery({
    queryKey: ["perfil-publico", pessoaId],
    enabled: !!pessoaId,
    staleTime: 60_000,
    queryFn: async (): Promise<PerfilPublico | null> => {
      const { data, error } = await supabase.rpc("rpc_perfil_publico", { p_pessoa_id: pessoaId as string });
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      return {
        ...row,
        disciplinas: Array.isArray(row.disciplinas) ? (row.disciplinas as unknown as PerfilDisciplina[]) : [],
      };
    },
  });
}
