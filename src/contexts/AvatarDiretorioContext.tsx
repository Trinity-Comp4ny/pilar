import { createContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { montarDiretorioDeFotos } from "@/lib/avatarDiretorio";

/** Nome da pessoa → URL da foto (chave por `chaveDeNome`). Vazio fora do provider. */
export const AvatarDiretorioContext = createContext<Map<string, string>>(new Map());

/**
 * Carrega uma vez as fotos da empresa para o AvatarStack achar a foto de quem
 * aparece só pelo nome (responsável, colaborador, autor). O ultra_admin lê todas
 * as empresas pela RLS, então as duas consultas filtram pela empresa do perfil.
 */
export function AvatarDiretorioProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;

  const { data } = useQuery({
    queryKey: ["avatar-diretorio", empresaId],
    enabled: !!empresaId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [pessoas, perfis] = await Promise.all([
        supabase
          .from("pessoas")
          .select("nome, profiles!pessoas_profile_id_fkey(avatar_url)")
          .eq("empresa_id", empresaId as string)
          .is("deleted_at", null),
        supabase
          .from("profiles")
          .select("nome, first_name, last_name, avatar_url")
          .eq("empresa_id", empresaId as string)
          .not("avatar_url", "is", null),
      ]);
      if (pessoas.error) throw pessoas.error;
      if (perfis.error) throw perfis.error;
      return montarDiretorioDeFotos(pessoas.data ?? [], perfis.data ?? []);
    },
  });

  const diretorio = useMemo(() => data ?? new Map<string, string>(), [data]);
  return <AvatarDiretorioContext.Provider value={diretorio}>{children}</AvatarDiretorioContext.Provider>;
}
