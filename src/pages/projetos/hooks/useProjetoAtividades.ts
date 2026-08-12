import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DisciplinaComentario } from "@/types/projetos";
import type { LinkItem } from "@/components/LinksEditor";
import type { Json } from "@/integrations/supabase/types";

/**
 * Atividades do projeto (spec 013): comentários e links guardados em colunas jsonb de
 * `projetos`. Uma query só (deduplicada pelo React Query) para o painel de atividades
 * e o bloco de links, que vivem em partes diferentes do modal.
 */
export function useProjetoAtividades(projetoId: string) {
  const qc = useQueryClient();
  const key = ["projeto-atividades", projetoId] as const;

  const { data } = useQuery({
    queryKey: key,
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("comentarios, links").eq("id", projetoId).single();
      if (error) throw error;
      return {
        comentarios: (data?.comentarios as unknown as DisciplinaComentario[]) ?? [],
        links: (data?.links as unknown as LinkItem[]) ?? [],
      };
    },
  });

  const salvar = useMutation({
    mutationFn: async (patch: { comentarios?: DisciplinaComentario[]; links?: LinkItem[] }) => {
      const upd: Record<string, unknown> = {};
      if (patch.comentarios) upd.comentarios = patch.comentarios as unknown as Json;
      if (patch.links) upd.links = patch.links as unknown as Json;
      const { error } = await supabase.from("projetos").update(upd as never).eq("id", projetoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { comentarios: data?.comentarios ?? [], links: data?.links ?? [], salvar };
}
