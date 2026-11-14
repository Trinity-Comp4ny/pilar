import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const PREVIAS_KEY = ["previas"] as const;

export interface RecursoPrevia {
  chave: string;
  nome: string;
  descricao: string;
}

/**
 * Prévia de recursos (SPEC 160): catálogo dos recursos em prévia e os que a pessoa ligou.
 * O código de um recurso novo pergunta `usePrevia("<chave>")` antes de mostrar a novidade.
 */
export function usePrevias() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [...PREVIAS_KEY, user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [recursos, ligadas] = await Promise.all([
        supabase.from("recursos_previa").select("chave, nome, descricao").eq("ativo", true).order("created_at"),
        supabase.from("usuario_previas").select("chave").eq("user_id", user!.id),
      ]);
      if (recursos.error) throw recursos.error;
      if (ligadas.error) throw ligadas.error;
      return { recursos: (recursos.data ?? []) as RecursoPrevia[], ligadas: (ligadas.data ?? []).map((l) => l.chave) };
    },
  });
  const ligadas = useMemo(() => new Set(query.data?.ligadas ?? []), [query.data]);
  return { recursos: query.data?.recursos ?? [], ligadas, isLoading: query.isLoading };
}

export function usePrevia(chave: string): boolean {
  const { recursos, ligadas } = usePrevias();
  return ligadas.has(chave) && recursos.some((r) => r.chave === chave);
}

export function useAlternarPrevia() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ chave, ligar }: { chave: string; ligar: boolean }) => {
      const { error } = ligar
        ? await supabase.from("usuario_previas").insert({ user_id: user!.id, chave })
        : await supabase.from("usuario_previas").delete().eq("user_id", user!.id).eq("chave", chave);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PREVIAS_KEY }),
  });
}
