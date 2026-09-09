import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LimitesEmpresa {
  maxProjetos: number | null;
  maxObras: number | null;
  maxUsuarios: number | null;
  tokensTotal: number | null;
  portalHabilitado: boolean;
  importHabilitado: boolean;
}

/**
 * Capacidade real da empresa (SPEC 098): `limites_empresa()` já resolve
 * pagante (plano + override) vs trial (nível de confiança) no banco. `null`
 * em qualquer campo numérico = sem limite. `isAdmin` decide quem vê o
 * formulário de desbloqueio (documento) e quem só vê "avisar administrador".
 */
export function useNivelConfianca() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  const isAdmin = profile?.role === "admin" || profile?.role === "owner" || profile?.role === "ultra_admin";

  const query = useQuery({
    queryKey: ["limites-empresa", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<LimitesEmpresa | null> => {
      const { data, error } = await supabase.rpc("limites_empresa", { p_empresa_id: empresaId! }).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        maxProjetos: data.max_projetos,
        maxObras: data.max_obras,
        maxUsuarios: data.max_usuarios,
        tokensTotal: data.tokens_total,
        portalHabilitado: data.portal_habilitado,
        importHabilitado: data.import_habilitado,
      };
    },
  });

  return {
    limites: query.data ?? null,
    isLoading: query.isLoading,
    isAdmin,
  };
}
