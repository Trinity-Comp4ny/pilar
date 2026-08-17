import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ONBOARDING_STEPS, type OnboardingCountSource } from "@/lib/onboarding/steps";
import {
  deriveProgress,
  filterVisibleSteps,
  type OnboardingSectionView,
  type OnboardingStepView,
} from "@/lib/onboarding/progress";

export type { OnboardingSectionView, OnboardingStepView };

// Filtro de contagem mínimo: as fontes misturam tabelas e uma view (lancamentos),
// então o union quebra os overloads de `.from()`. Fixamos um nome concreto só para
// escolher o overload e tipamos o encadeamento eq/is aqui.
type CountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq(column: string, value: string): CountQuery;
  is(column: string, value: null): CountQuery;
};

async function countSource(
  source: OnboardingCountSource,
  softDelete: boolean,
  empresaId: string,
): Promise<number> {
  const select = supabase
    .from(source as "clientes")
    .select("id", { count: "exact", head: true }) as unknown as CountQuery;
  const query = softDelete
    ? select.eq("empresa_id", empresaId).is("deleted_at", null)
    : select.eq("empresa_id", empresaId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Deriva o progresso do onboarding a partir de dados reais. Filtra os passos pelo
 * que a empresa/usuário pode ver (feature + admin), conta as entidades e agrupa por
 * pilar (deriveProgress). Sem contagem gravada: se existe 1 registro, passo concluído.
 */
export function useOnboardingProgress() {
  const { profile } = useAuth();
  const { can, isAdmin } = usePermissions();
  const empresaId = profile?.empresa_id ?? null;

  const visibleSteps = useMemo(
    () => filterVisibleSteps(ONBOARDING_STEPS, can, isAdmin),
    [can, isAdmin],
  );

  const sources = useMemo(() => {
    const map = new Map<OnboardingCountSource, boolean>();
    for (const s of visibleSteps) map.set(s.count.source, s.count.softDelete);
    return [...map.entries()].map(([source, softDelete]) => ({ source, softDelete }));
  }, [visibleSteps]);

  const sourceKeys = sources.map((s) => s.source).sort().join(",");

  const { data: counts, isLoading } = useQuery({
    queryKey: ["onboarding-progress", empresaId, sourceKeys],
    enabled: !!empresaId && sources.length > 0,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!empresaId) return {} as Record<string, number>;
      const entries = await Promise.all(
        sources.map(async ({ source, softDelete }) => {
          const n = await countSource(source, softDelete, empresaId);
          return [source, n] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  return useMemo(() => {
    const derived = deriveProgress(visibleSteps, counts ?? {});
    return { ...derived, loading: isLoading, hasEmpresa: !!empresaId };
  }, [visibleSteps, counts, isLoading, empresaId]);
}
