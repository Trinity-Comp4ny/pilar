import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ehObjetivo } from "@/lib/perfilEscritorio";
import { ONBOARDING_STEPS, chaveDaContagem, ordemDosPilares, type OnboardingCheck } from "@/lib/onboarding/steps";
import {
  deriveProgress,
  filterVisibleSteps,
  type OnboardingSectionView,
  type OnboardingStepView,
} from "@/lib/onboarding/progress";

export type { OnboardingSectionView, OnboardingStepView };

type CheckTabela = Extract<OnboardingCheck, { tipo: "tabela" }>;

// Filtro de contagem mínimo: as fontes misturam tabelas e uma view (lancamentos),
// então o union quebra os overloads de `.from()`. Fixamos um nome concreto só para
// escolher o overload e tipamos o encadeamento eq/is aqui.
type CountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq(column: string, value: string | boolean): CountQuery;
  is(column: string, value: null): CountQuery;
};

async function countSource(check: CheckTabela, empresaId: string): Promise<number> {
  let query = (
    supabase.from(check.source as "clientes").select("id", { count: "exact", head: true }) as unknown as CountQuery
  ).eq("empresa_id", empresaId);
  if (check.ativos) query = query.is(check.ativos, null);
  // Dado de demonstração não conta como uso real (SPEC 149).
  if (check.semExemplo) query = query.eq("exemplo", false);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Deriva o progresso do onboarding a partir de dados reais. Filtra os passos pelo
 * que a empresa/usuário pode ver (feature + admin), conta as entidades, olha o
 * próprio perfil e agrupa por seção na ordem escolhida pelo escritório.
 */
export function useOnboardingProgress() {
  const { profile } = useAuth();
  const { can, isAdmin } = usePermissions();
  const empresaId = profile?.empresa_id ?? null;
  const objetivo = profile?.empresas?.objetivo_inicial;

  const visibleSteps = useMemo(() => filterVisibleSteps(ONBOARDING_STEPS, can, isAdmin), [can, isAdmin]);

  const contagens = useMemo(() => {
    const map = new Map<string, CheckTabela>();
    for (const s of visibleSteps) {
      if (s.check.tipo === "tabela") map.set(chaveDaContagem(s.check), s.check);
    }
    return [...map.entries()];
  }, [visibleSteps]);

  const chaves = contagens
    .map(([k]) => k)
    .sort()
    .join(",");

  const { data: counts, isLoading } = useQuery({
    queryKey: ["onboarding-progress", empresaId, chaves],
    enabled: !!empresaId && contagens.length > 0,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!empresaId) return {} as Record<string, number>;
      const entries = await Promise.all(
        contagens.map(async ([chave, check]) => [chave, await countSource(check, empresaId)] as const)
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  const avatarUrl = profile?.avatar_url ?? null;

  return useMemo(() => {
    const ordem = ordemDosPilares(ehObjetivo(objetivo) ? objetivo : null);
    const derived = deriveProgress(visibleSteps, { counts: counts ?? {}, perfil: { avatar_url: avatarUrl } }, ordem);
    return { ...derived, loading: isLoading, hasEmpresa: !!empresaId };
  }, [visibleSteps, counts, isLoading, empresaId, objetivo, avatarUrl]);
}
