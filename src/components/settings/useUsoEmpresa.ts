import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMySubscription } from "@/pages/billing/hooks/useMySubscription";
import { useNivelConfianca } from "@/hooks/useNivelConfianca";

export interface UsoEmpresa {
  projetosAtivos: number;
  obrasAtivas: number;
  leadsAtivos: number;
  usuarios: number;
  maxProjetos: number | null;
  maxObras: number | null;
  maxLeads: number | null;
  maxUsuarios: number | null;
  planoNome: string | null;
  tokensPlano: number;
  tokensComprado: number;
}

// "Ativo" segue o mesmo critério dos triggers de capacidade do banco
// (enforce_capacidade_*): projeto fora de Concluído/Cancelado, obra fora de
// concluida e lead fora de Ganho/Perdido, nenhum removido. Assim o medidor bate
// com a faixa que o banco aplica. Os tetos vêm de limites_empresa(), que já
// resolve plano, override e trial.
export function useUsoEmpresa() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  const { data: subscription } = useMySubscription();
  const { limites } = useNivelConfianca();

  const query = useQuery({
    queryKey: ["uso-empresa", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<{
      projetosAtivos: number;
      obrasAtivas: number;
      leadsAtivos: number;
      usuarios: number;
      tokensPlano: number;
      tokensComprado: number;
    }> => {
      const [
        { count: projetosAtivos },
        { count: obrasAtivas },
        { count: leadsAtivos },
        { count: usuarios },
        { data: saldo },
      ] = await Promise.all([
        // projetos_safe: select("*") na tabela base foi revogado (20260879000000),
        // só colunas explícitas são concedidas (sem valor_contrato/custo_indireto_pct).
        supabase
          .from("projetos_safe")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null)
          .not("status", "in", '("Concluído","Cancelado")'),
        supabase
          .from("obras")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null)
          .neq("status", "concluida"),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null)
          .not("status", "in", '("Ganho","Perdido")'),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId!)
          .is("desativado_em", null),
        supabase
          .from("ai_token_saldo")
          .select("saldo_plano, saldo_comprado")
          .eq("empresa_id", empresaId!)
          .maybeSingle(),
      ]);
      return {
        projetosAtivos: projetosAtivos ?? 0,
        obrasAtivas: obrasAtivas ?? 0,
        leadsAtivos: leadsAtivos ?? 0,
        usuarios: usuarios ?? 0,
        tokensPlano: saldo?.saldo_plano ?? 0,
        tokensComprado: saldo?.saldo_comprado ?? 0,
      };
    },
  });

  const uso: UsoEmpresa = {
    projetosAtivos: query.data?.projetosAtivos ?? 0,
    obrasAtivas: query.data?.obrasAtivas ?? 0,
    leadsAtivos: query.data?.leadsAtivos ?? 0,
    usuarios: query.data?.usuarios ?? 0,
    maxProjetos: limites?.maxProjetos ?? null,
    maxObras: limites?.maxObras ?? null,
    maxLeads: limites?.maxLeads ?? null,
    maxUsuarios: subscription?.plan?.max_usuarios ?? null,
    planoNome: subscription?.plan?.nome ?? null,
    tokensPlano: query.data?.tokensPlano ?? 0,
    tokensComprado: query.data?.tokensComprado ?? 0,
  };

  return { uso, isLoading: query.isLoading, error: query.error as Error | null };
}
