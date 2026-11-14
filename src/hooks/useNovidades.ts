import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { lerNovidades, novidadesPendentes, type Novidades, type Pendentes } from "@/lib/novidades";

export const NOVIDADES_KEY = ["novidades"] as const;

/** Busca as novidades publicadas (SPEC 152). Release sai poucas vezes por semana: cache longo. */
export async function buscarNovidades(): Promise<Novidades> {
  const { data, error } = await supabase.rpc("novidades_publicadas");
  if (error) throw error;
  return lerNovidades(data);
}

export function useNovidades() {
  const { user } = useAuth();
  const { can } = usePermissions();

  const query = useQuery({
    queryKey: NOVIDADES_KEY,
    queryFn: buscarNovidades,
    enabled: !!user,
    staleTime: 60 * 60 * 1000,
  });

  const releases = useMemo(() => query.data?.releases ?? [], [query.data]);
  const pendentes: Pendentes = useMemo(
    () => novidadesPendentes(releases, (modulo) => can(modulo, "view")),
    [releases, can]
  );

  return { ...query, releases, pendentes };
}

export function useMarcarNovidadesVistas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("marcar_novidades_vistas");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOVIDADES_KEY }),
  });
}
