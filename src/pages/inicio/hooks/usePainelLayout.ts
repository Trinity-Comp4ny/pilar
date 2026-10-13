import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Layout do painel, por usuário (ADR 0038).
 *
 * Vive em `profiles.painel_layout` e chega junto do profile, sem query extra.
 * Lista vazia significa "usar o padrão", e o padrão é do front (por papel),
 * para que mudá-lo não exija migration de dado de ninguém.
 */

export const TAMANHOS = ["kpi", "terco", "meia", "inteira"] as const;
export type Tamanho = (typeof TAMANHOS)[number];

export const ZONAS = ["topo", "grade"] as const;
export type Zona = (typeof ZONAS)[number];

/** `z` ausente significa grade: mantém válido o layout de quem salvou antes. */
export type ItemLayout = { w: string; s: Tamanho; z?: Zona };

const itemSchema = z.object({ w: z.string().min(1), s: z.enum(TAMANHOS), z: z.enum(ZONAS).optional() });
const layoutSchema = z.array(itemSchema);

export const LIMITE_WIDGETS = 40;
export const LIMITE_FIXOS = 6;

export function usePainelLayout(padrao: ItemLayout[]) {
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const salvo = useMemo<ItemLayout[] | null>(() => {
    const raw = (profile as { painel_layout?: unknown } | null)?.painel_layout;
    const parsed = layoutSchema.safeParse(raw);
    // Layout é estado que envelhece: id de widget que saiu num release futuro é
    // ignorado na leitura, nunca quebra a tela.
    if (!parsed.success || parsed.data.length === 0) return null;
    return parsed.data;
  }, [profile]);

  const layout = salvo ?? padrao;
  const usandoPadrao = salvo === null;

  const mutation = useMutation({
    mutationFn: async (proximo: ItemLayout[]) => {
      const { error } = await supabase.rpc("set_painel_layout", { p_layout: proximo });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile?.();
      await queryClient.invalidateQueries({ queryKey: ["painel-gestao"] });
    },
    onError: (error: Error) => {
      toast.error(`Não foi possível salvar o painel: ${error.message}`);
    },
  });

  const salvar = useCallback((proximo: ItemLayout[]) => mutation.mutateAsync(proximo), [mutation]);
  const restaurarPadrao = useCallback(() => mutation.mutateAsync([]), [mutation]);

  return { layout, usandoPadrao, salvar, restaurarPadrao, salvando: mutation.isPending };
}
