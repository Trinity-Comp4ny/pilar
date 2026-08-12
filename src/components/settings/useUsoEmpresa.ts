import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMySubscription } from "@/pages/billing/hooks/useMySubscription";

export interface UsoEmpresa {
  projetosAtivos: number;
  usuarios: number;
  maxProjetos: number | null;
  maxUsuarios: number | null;
  planoNome: string | null;
}

// "Projeto ativo" = não removido (deleted_at IS NULL). É o mesmo critério que o
// backoffice usa para aferir o limite do plano (admin/tabs/Plano.tsx), então o
// medidor bate com a régua de cobrança real (faixa de projetos ativos, PRICING v2).
export function useUsoEmpresa() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  const { data: subscription } = useMySubscription();

  const query = useQuery({
    queryKey: ["uso-empresa", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<{ projetosAtivos: number; usuarios: number }> => {
      const [{ count: projetosAtivos }, { count: usuarios }] = await Promise.all([
        supabase
          .from("projetos")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId!),
      ]);
      return { projetosAtivos: projetosAtivos ?? 0, usuarios: usuarios ?? 0 };
    },
  });

  const uso: UsoEmpresa = {
    projetosAtivos: query.data?.projetosAtivos ?? 0,
    usuarios: query.data?.usuarios ?? 0,
    maxProjetos: subscription?.plan?.max_projetos ?? null,
    maxUsuarios: subscription?.plan?.max_usuarios ?? null,
    planoNome: subscription?.plan?.nome ?? null,
  };

  return { uso, isLoading: query.isLoading, error: query.error as Error | null };
}
